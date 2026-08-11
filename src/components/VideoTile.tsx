import Image from "next/image";
import type { CatalogVideo } from "@/types/video";

export default function VideoTile({ video }: { video: CatalogVideo }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block aspect-video w-full shrink-0 overflow-hidden rounded-md bg-zinc-800 transition-transform duration-300 ease-out hover:z-10 hover:scale-110"
    >
      <Image
        src={video.thumbnailUrl}
        alt={video.title}
        fill
        sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
        className="object-cover"
        unoptimized
      />
      <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
        {video.duration}
      </span>
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/20 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <p className="line-clamp-2 text-sm font-semibold text-white">{video.title}</p>
        <p className="mt-1 text-xs text-zinc-300">{video.channelTitle}</p>
      </div>
    </a>
  );
}
