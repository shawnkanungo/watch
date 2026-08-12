import type { CatalogVideo } from "@/types/video";

export default function Hero({ video }: { video: CatalogVideo }) {
  const embedSrc = `https://www.youtube.com/embed/${video.id}?autoplay=1&mute=1&loop=1&playlist=${video.id}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&playsinline=1`;

  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="relative block h-[56vw] max-h-[70vh] min-h-[320px] w-full overflow-hidden bg-black"
    >
      <iframe
        src={embedSrc}
        title={video.title}
        allow="autoplay; encrypted-media"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2"
      />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#141414] to-transparent" />
    </a>
  );
}
