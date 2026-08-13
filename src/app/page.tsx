import videos from "../../content/videos.json";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Row from "@/components/Row";
import type { CatalogVideo } from "@/types/video";

const catalog = videos as CatalogVideo[];

// Curated playlists and title-based rules surface first (most editorial);
// anything else falls into "Trending Now" last. Order is fixed so the page
// looks identical on every rebuild for the same input data.
const ROW_ORDER = [
  "Agentic AI & AI Agents",
  "Keynote Speaker Reels",
  "Generative AI & The Future",
  "AI Tools & Products",
  "Future of Work & Careers",
  "Innovation & Disruption",
  "Customer Experience & Trends",
  "Public Sector, Healthcare & HR",
  "Boldness & Mindset",
  "Presentation & Storytelling Craft",
  "Behind the Scenes & Personal",
  "Trending Now",
];

function groupByCategory(items: CatalogVideo[]) {
  const rows = new Map<string, CatalogVideo[]>();
  for (const video of items) {
    for (const category of video.categories) {
      const row = rows.get(category) ?? [];
      row.push(video);
      rows.set(category, row);
    }
  }

  const known = ROW_ORDER.filter((name) => rows.has(name));
  const extra = [...rows.keys()].filter((name) => !ROW_ORDER.includes(name)).sort();
  return [...known, ...extra].map((name) => [name, rows.get(name)!] as const);
}

export default function Home() {
  const rows = groupByCategory(catalog);
  const keynoteReels = catalog.filter((video) =>
    video.categories.includes("Keynote Speaker Reels")
  );
  const hero = keynoteReels[0] ?? catalog[0];

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <Navbar />

      {hero && <Hero video={hero} />}

      <main className="flex flex-col gap-10 pb-16 pt-4 sm:pt-6">
        {catalog.length === 0 && (
          <p className="px-4 text-zinc-400 sm:px-8">
            No videos yet. Run <code className="font-mono">npm run fetch:videos</code>{" "}
            with a <code className="font-mono">YOUTUBE_API_KEY</code> set to populate
            the catalog.
          </p>
        )}

        {rows.map(([category, items]) => (
          <Row key={category} title={category} videos={items} />
        ))}
      </main>
    </div>
  );
}
