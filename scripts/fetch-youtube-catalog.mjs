#!/usr/bin/env node
// Build-time only: fetches a bounded, deterministic set of videos from the
// configured YouTube channels and writes content/videos.json.
// Never invoked at request time — see package.json "prebuild".

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'content', 'videos.json');

const API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_HANDLES = ['@shawn.kanungo'];
const TOTAL_LIMIT = 100;
const PAGES_PER_CHANNEL = 2;
// A channel's recent uploads can skew heavily toward Shorts, so filling the
// 100-video target means paging deeper into its history, not just the most
// recent 100 uploads. This bounds how deep we'll go per channel (50/page) —
// finite and deterministic, not open-ended pagination.
const MAX_UPLOAD_PAGES_PER_CHANNEL = 40;
const API_BASE = 'https://www.googleapis.com/youtube/v3';
const FALLBACK_CATEGORY = 'Trending Now';

// YouTube caps Shorts at 3 minutes, so anything longer is guaranteed
// long-form and skips the network check below. Anything at or under that
// gets verified against YouTube's own Shorts classification, since Shorts
// can run well past the old 60-second assumption and duration alone is not
// a reliable signal anymore.
const SHORTS_CANDIDATE_MAX_SECONDS = 180;
const SHORTS_CHECK_CONCURRENCY = 8;

// Deterministic keyword rules applied to each title, in this order, so a
// re-run always assigns the same categories to the same videos. A video can
// match more than one rule, mirroring how a title can live in several
// Netflix genre rows at once. Rules are ordered most-specific first so a
// video lands in its sharpest genre(s) before falling through to the broad
// "Generative AI & The Future" catch-all, then finally FALLBACK_CATEGORY.
const CATEGORY_RULES = [
  // Merges with the curated "Keynote Speaker Reels" playlist (see
  // buildPlaylistCategoryMap) rather than being a separate row — every
  // title matching "keynote reel" already sits inside that playlist.
  { name: 'Keynote Speaker Reels', test: (t) => /keynote reel/i.test(t) },
  {
    name: 'Agentic AI & AI Agents',
    test: (t) => /agentic ai|ai agents?|\bagent\b/i.test(t),
  },
  {
    name: 'AI Tools & Products',
    test: (t) =>
      /chatgpt|gpt-?\d|\bo1\b|openai|gemini|claude|vercel|\bv0\b|sora|perplexity|copilot|scarlett johansson/i.test(
        t
      ),
  },
  {
    name: 'Future of Work & Careers',
    test: (t) => /future of work|\bjobs?\b|career|knowledge work|labou?r|\brecruit/i.test(t),
  },
  {
    name: 'Innovation & Disruption',
    test: (t) => /innovation|disrupt|strategist|\bstrategy\b/i.test(t),
  },
  {
    name: 'Customer Experience & Trends',
    test: (t) =>
      /customer|\bcx\b|trend|attention economy|addiction economy|narrator economy|superstars|costly signaling/i.test(
        t
      ),
  },
  {
    name: 'Public Sector, Healthcare & HR',
    test: (t) => /healthcare|public sector|government|\bhr\b|bureaucracy/i.test(t),
  },
  {
    name: 'Boldness & Mindset',
    test: (t) => /\bbold\b|boldness|darkness|imposters|scared|exposure/i.test(t),
  },
  {
    name: 'Presentation & Storytelling Craft',
    test: (t) => /slides|presentation|storytell/i.test(t),
  },
  {
    name: 'Behind the Scenes & Personal',
    test: (t) =>
      /vlog|behind the scenes|interview|book signing|book advance|green room|mixtape|audition tape|anniversary|convocation|headlining|entrepreneur|aging parents/i.test(
        t
      ),
  },
  {
    name: 'Generative AI & The Future',
    test: (t) => /generative ai|artificial intelligence|\bai\b/i.test(t),
  },
  {
    name: 'Financial Services & Credit Unions',
    test: (t) =>
      /credit union|financial services|wealth management|\bcfo\b|fintech/i.test(t),
  },
];

// Mirror this order in src/app/page.tsx's ROW_ORDER — most curated/specific
// genres first, the broad AI catch-all near the end, FALLBACK_CATEGORY last.

// "Financial Services & Credit Unions" content tends to be older, so it
// rarely survives the newest-100 cutoff below on title matching alone.
// These search queries reach deeper into the channel's history to find it;
// final inclusion still requires a title match against CATEGORY_RULES above,
// so a broad/fuzzy YouTube search match alone can't sneak an unrelated video
// in. The queries themselves are a fixed list, so results stay deterministic
// run to run (subject only to the channel's own content changing).
const FINANCIAL_SERVICES_SEARCH_QUERIES = ['credit union', 'financial services'];
const GUARANTEED_CATEGORY_NAME = 'Financial Services & Credit Unions';

if (!API_KEY) {
  console.error(
    'Missing YOUTUBE_API_KEY. Set it in .env.local (build-time only, never sent to the client).'
  );
  process.exit(1);
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API error ${res.status} for ${url}\n${body}`);
  }
  return res.json();
}

function buildUrl(endpoint, params) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('key', API_KEY);
  return url.toString();
}

// ISO 8601 duration (e.g. PT1M32S) -> seconds
function parseIsoDurationToSeconds(iso) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
}

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

async function resolveUploadsPlaylistId(handle) {
  const url = buildUrl('channels', {
    part: 'contentDetails,snippet',
    forHandle: handle.replace(/^@/, ''),
  });
  const data = await getJson(url);
  const channel = data.items?.[0];
  if (!channel) {
    throw new Error(`Could not resolve channel for handle ${handle}`);
  }
  return {
    channelId: channel.id,
    channelTitle: channel.snippet.title,
    uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads,
  };
}

async function fetchUploadsPage(uploadsPlaylistId, pageToken) {
  const url = buildUrl('playlistItems', {
    part: 'contentDetails,snippet,status',
    playlistId: uploadsPlaylistId,
    maxResults: '50',
    ...(pageToken ? { pageToken } : {}),
  });
  return getJson(url);
}

async function fetchChannelPlaylists(channelId) {
  const url = buildUrl('playlists', {
    part: 'snippet',
    channelId,
    maxResults: '50',
  });
  const data = await getJson(url);
  return data.items ?? [];
}

async function fetchPlaylistVideoIds(playlistId, pages) {
  const videoIds = [];
  let pageToken;
  for (let page = 0; page < pages; page += 1) {
    const url = buildUrl('playlistItems', {
      part: 'contentDetails',
      playlistId,
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    });
    const data = await getJson(url);
    videoIds.push(...(data.items ?? []).map((item) => item.contentDetails.videoId));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return videoIds;
}

// Maps videoId -> Set of curated playlist titles it belongs to.
async function buildPlaylistCategoryMap(channelId) {
  const playlists = await fetchChannelPlaylists(channelId);
  const map = new Map();
  for (const playlist of playlists) {
    const videoIds = await fetchPlaylistVideoIds(playlist.id, PAGES_PER_CHANNEL);
    for (const videoId of videoIds) {
      const categories = map.get(videoId) ?? new Set();
      categories.add(playlist.snippet.title);
      map.set(videoId, categories);
    }
  }
  return map;
}

function categorize(title, playlistCategories) {
  const categories = new Set(playlistCategories ?? []);
  for (const rule of CATEGORY_RULES) {
    if (rule.test(title)) categories.add(rule.name);
  }
  if (categories.size === 0) categories.add(FALLBACK_CATEGORY);
  return [...categories].sort();
}

function buildRecord(video, channel, playlistCategoryMap) {
  const durationSeconds = parseIsoDurationToSeconds(video.contentDetails.duration);
  return {
    id: video.id,
    title: video.snippet.title,
    thumbnailUrl:
      video.snippet.thumbnails?.maxres?.url ??
      video.snippet.thumbnails?.high?.url ??
      video.snippet.thumbnails?.medium?.url ??
      video.snippet.thumbnails?.default?.url,
    publishedAt: video.snippet.publishedAt,
    channelId: channel.channelId,
    channelTitle: channel.channelTitle,
    durationSeconds,
    duration: formatDuration(durationSeconds),
    url: `https://www.youtube.com/watch?v=${video.id}`,
    categories: categorize(video.snippet.title, playlistCategoryMap.get(video.id)),
  };
}

async function searchChannelVideoIds(channelId, query) {
  const url = buildUrl('search', {
    part: 'id',
    channelId,
    q: query,
    type: 'video',
    maxResults: '25',
  });
  const data = await getJson(url);
  return (data.items ?? []).map((item) => item.id.videoId);
}

// Finds eligible, non-Short videos matching GUARANTEED_CATEGORY_NAME
// anywhere in the channel's history (not just the newest uploads), so sparse
// but important topics aren't starved out by the newest-100 cutoff.
async function fetchGuaranteedCategoryVideos(channel, playlistCategoryMap) {
  const idLists = await Promise.all(
    FINANCIAL_SERVICES_SEARCH_QUERIES.map((q) => searchChannelVideoIds(channel.channelId, q))
  );
  const candidateIds = [...new Set(idLists.flat())];
  if (candidateIds.length === 0) return [];

  const videoDetails = await fetchVideoDetails(candidateIds);
  const records = videoDetails
    .filter((video) => isEligible(video))
    .map((video) => buildRecord(video, channel, playlistCategoryMap))
    // Gate on our own deterministic title rule, not YouTube's fuzzy search
    // match, so an unrelated video that merely mentions the topic in its
    // description can't end up guaranteed a slot.
    .filter((record) => record.categories.includes(GUARANTEED_CATEGORY_NAME));

  return filterOutShorts(records);
}

async function fetchVideoDetails(videoIds) {
  const details = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const url = buildUrl('videos', {
      part: 'contentDetails,snippet,status,liveStreamingDetails',
      id: batch.join(','),
    });
    const data = await getJson(url);
    details.push(...(data.items ?? []));
  }
  return details;
}

function isEligible(video) {
  const { status, liveStreamingDetails } = video;

  if (status?.privacyStatus !== 'public') return false;

  // Live streams currently in progress.
  if (liveStreamingDetails?.actualStartTime && !liveStreamingDetails?.actualEndTime) {
    return false;
  }

  // Premieres not yet aired: scheduled start time in the future, not yet live.
  if (
    liveStreamingDetails?.scheduledStartTime &&
    !liveStreamingDetails?.actualStartTime
  ) {
    return false;
  }

  return true;
}

// YouTube's own classification: requesting /shorts/{id} serves the Shorts
// player (200) for a Short, or redirects to /watch?v={id} (3xx) for a
// regular video. This is more reliable than a duration cutoff.
async function isShort(videoId, attempt = 1) {
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${videoId}`, {
      redirect: 'manual',
    });
    if (res.status >= 300 && res.status < 400) return false;
    if (res.status === 200) return true;
    throw new Error(`Unexpected status ${res.status} checking Shorts status for ${videoId}`);
  } catch (err) {
    if (attempt >= 3) throw err;
    await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    return isShort(videoId, attempt + 1);
  }
}

async function filterOutShorts(candidates) {
  const toCheck = candidates.filter(
    (c) => c.durationSeconds <= SHORTS_CANDIDATE_MAX_SECONDS
  );
  const shortIds = new Set();

  let cursor = 0;
  async function worker() {
    while (cursor < toCheck.length) {
      const current = toCheck[cursor];
      cursor += 1;
      if (await isShort(current.id)) shortIds.add(current.id);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(SHORTS_CHECK_CONCURRENCY, toCheck.length) }, worker)
  );

  return candidates.filter((c) => !shortIds.has(c.id));
}

// Pages through a channel's uploads, oldest-page-last, collecting eligible
// non-Short videos until it has TOTAL_LIMIT of them or the channel runs out.
async function collectChannelVideos(channel, playlistCategoryMap) {
  const eligible = [];
  let pageToken;
  let pagesFetched = 0;

  while (eligible.length < TOTAL_LIMIT && pagesFetched < MAX_UPLOAD_PAGES_PER_CHANNEL) {
    const page = await fetchUploadsPage(channel.uploadsPlaylistId, pageToken);
    const items = page.items ?? [];
    pagesFetched += 1;
    pageToken = page.nextPageToken;
    if (items.length === 0) break;

    const videoIds = items.map((item) => item.contentDetails.videoId);
    const videoDetails = await fetchVideoDetails(videoIds);
    const videoDetailsById = new Map(videoDetails.map((v) => [v.id, v]));

    const pageCandidates = [];
    for (const item of items) {
      const videoId = item.contentDetails.videoId;
      const video = videoDetailsById.get(videoId);
      if (!video || !isEligible(video)) continue;
      pageCandidates.push(buildRecord(video, channel, playlistCategoryMap));
    }

    eligible.push(...(await filterOutShorts(pageCandidates)));

    if (!pageToken) break;
  }

  return eligible;
}

async function main() {
  const channels = await Promise.all(CHANNEL_HANDLES.map(resolveUploadsPlaylistId));

  const perChannelVideos = await Promise.all(
    channels.map(async (channel) => {
      const playlistCategoryMap = await buildPlaylistCategoryMap(channel.channelId);
      const [general, guaranteed] = await Promise.all([
        collectChannelVideos(channel, playlistCategoryMap),
        fetchGuaranteedCategoryVideos(channel, playlistCategoryMap),
      ]);

      // Reserve slots for guaranteed videos first, then fill the rest of
      // this channel's share of TOTAL_LIMIT with the newest eligible ones —
      // so sparse topics like financial services survive even though
      // they're older than the natural newest-100 cutoff.
      const guaranteedIds = new Set(guaranteed.map((v) => v.id));
      const remainingSlots = Math.max(0, TOTAL_LIMIT - guaranteed.length);
      const rest = general.filter((v) => !guaranteedIds.has(v.id)).slice(0, remainingSlots);
      return [...guaranteed, ...rest];
    })
  );
  const records = perChannelVideos.flat();

  // Dedupe (a video could theoretically surface twice within a channel's own pages).
  const dedupedById = new Map(records.map((r) => [r.id, r]));
  const deduped = [...dedupedById.values()];

  // Sort newest -> oldest; break ties by id for deterministic, stable ordering.
  deduped.sort((a, b) => {
    const byDate = new Date(b.publishedAt) - new Date(a.publishedAt);
    if (byDate !== 0) return byDate;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const truncated = deduped.slice(0, TOTAL_LIMIT);

  if (truncated.length < TOTAL_LIMIT) {
    console.warn(
      `Warning: only ${truncated.length} eligible videos found across ${channels.length} channel(s); ` +
        `combined channels have fewer than ${TOTAL_LIMIT} non-Shorts uploads. Writing all available.`
    );
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(truncated, null, 2)}\n`, 'utf-8');
  console.log(`Wrote ${truncated.length} video record(s) to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
