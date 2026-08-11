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
const SHORTS_MAX_SECONDS = 60;
const PAGES_PER_CHANNEL = 2;
const API_BASE = 'https://www.googleapis.com/youtube/v3';

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

async function fetchRecentPlaylistItems(uploadsPlaylistId, pages) {
  const items = [];
  let pageToken;
  for (let page = 0; page < pages; page += 1) {
    const url = buildUrl('playlistItems', {
      part: 'contentDetails,snippet,status',
      playlistId: uploadsPlaylistId,
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    });
    const data = await getJson(url);
    items.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return items;
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
  const { status, liveStreamingDetails, contentDetails } = video;

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

  const durationSeconds = parseIsoDurationToSeconds(contentDetails.duration);
  if (durationSeconds <= SHORTS_MAX_SECONDS) return false; // Shorts

  return true;
}

async function main() {
  const channels = await Promise.all(CHANNEL_HANDLES.map(resolveUploadsPlaylistId));

  const candidatesByChannel = await Promise.all(
    channels.map(async (channel) => {
      const playlistItems = await fetchRecentPlaylistItems(
        channel.uploadsPlaylistId,
        PAGES_PER_CHANNEL
      );
      return { channel, playlistItems };
    })
  );

  const allVideoIds = candidatesByChannel.flatMap(({ playlistItems }) =>
    playlistItems.map((item) => item.contentDetails.videoId)
  );
  const uniqueVideoIds = [...new Set(allVideoIds)];
  const videoDetails = await fetchVideoDetails(uniqueVideoIds);
  const videoDetailsById = new Map(videoDetails.map((v) => [v.id, v]));

  const records = [];
  for (const { channel, playlistItems } of candidatesByChannel) {
    for (const item of playlistItems) {
      const videoId = item.contentDetails.videoId;
      const video = videoDetailsById.get(videoId);
      if (!video || !isEligible(video)) continue;

      const durationSeconds = parseIsoDurationToSeconds(video.contentDetails.duration);
      records.push({
        id: videoId,
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
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });
    }
  }

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
