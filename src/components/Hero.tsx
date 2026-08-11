import type { CatalogVideo } from "@/types/video";

export default function Hero({ video }: { video: CatalogVideo }) {
  return (
    <section className="relative h-[56vw] max-h-[85vh] min-h-[380px] w-full">
      <div
        className="absolute inset-0 bg-cover bg-top"
        style={{ backgroundImage: `url(${video.thumbnailUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/20 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/80 via-transparent to-transparent" />

      <div className="absolute bottom-[12%] flex max-w-xl flex-col gap-4 px-4 sm:px-8">
        <h1 className="text-3xl font-black leading-tight text-white drop-shadow-lg sm:text-5xl">
          {video.title}
        </h1>
        <p className="text-sm text-zinc-300 sm:text-base">
          {video.channelTitle} · {video.duration}
        </p>
        <div className="flex gap-3">
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded bg-white px-6 py-2.5 font-bold text-black transition-colors hover:bg-white/80"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M8 5v14l11-7z" />
            </svg>
            Play
          </a>
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded bg-white/25 px-6 py-2.5 font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/40"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
            </svg>
            More Info
          </a>
        </div>
      </div>
    </section>
  );
}
