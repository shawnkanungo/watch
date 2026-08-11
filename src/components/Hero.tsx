import type { CatalogVideo } from "@/types/video";

export default function Hero({ video }: { video: CatalogVideo }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="relative block h-[56vw] max-h-[70vh] min-h-[320px] w-full"
    >
      <div
        className="absolute inset-0 bg-cover bg-top"
        style={{ backgroundImage: `url(${video.thumbnailUrl})` }}
      />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#141414] to-transparent" />
    </a>
  );
}
