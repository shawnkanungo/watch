import videos from "../../content/videos.json";
import VideoTile from "@/components/VideoTile";
import type { CatalogVideo } from "@/types/video";

const catalog = videos as CatalogVideo[];

function groupByChannel(items: CatalogVideo[]) {
  const rows = new Map<string, CatalogVideo[]>();
  for (const video of items) {
    const row = rows.get(video.channelTitle) ?? [];
    row.push(video);
    rows.set(video.channelTitle, row);
  }
  return [...rows.entries()];
}

export default function Home() {
  const rows = groupByChannel(catalog);

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <header className="sticky top-0 z-20 bg-gradient-to-b from-black/90 to-transparent px-4 py-6 sm:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-[#e50914] sm:text-3xl">
          Catalog
        </h1>
      </header>

      <main className="flex flex-col gap-10 px-4 pb-16 sm:px-8">
        {catalog.length === 0 && (
          <p className="text-zinc-400">
            No videos yet. Run <code className="font-mono">npm run fetch:videos</code>{" "}
            with a <code className="font-mono">YOUTUBE_API_KEY</code> set to populate
            the catalog.
          </p>
        )}

        {rows.map(([channelTitle, items]) => (
          <section key={channelTitle} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold sm:text-xl">{channelTitle}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map((video) => (
                <VideoTile key={video.id} video={video} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
