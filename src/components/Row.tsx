"use client";

import { useRef } from "react";
import type { CatalogVideo } from "@/types/video";
import VideoTile from "@/components/VideoTile";

export default function Row({
  title,
  videos,
}: {
  title: string;
  videos: CatalogVideo[];
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollBy(direction: 1 | -1) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * scroller.clientWidth * 0.9, behavior: "smooth" });
  }

  return (
    <section className="group/row relative flex flex-col gap-2">
      <h2 className="px-4 text-lg font-semibold text-white sm:px-8 sm:text-xl">{title}</h2>

      <div className="relative">
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollBy(-1)}
          className="absolute left-0 top-0 z-10 hidden h-full w-10 items-center justify-center bg-gradient-to-r from-[#141414] to-transparent text-white opacity-0 transition-opacity group-hover/row:opacity-100 sm:flex hover:cursor-pointer"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
            <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>

        <div
          ref={scrollerRef}
          className="flex gap-2 overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] sm:px-8 [&::-webkit-scrollbar]:hidden"
        >
          {videos.map((video) => (
            <div key={video.id} className="w-[45vw] shrink-0 sm:w-[23vw] lg:w-[18vw]">
              <VideoTile video={video} />
            </div>
          ))}
        </div>

        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollBy(1)}
          className="absolute right-0 top-0 z-10 hidden h-full w-10 items-center justify-center bg-gradient-to-l from-[#141414] to-transparent text-white opacity-0 transition-opacity group-hover/row:opacity-100 sm:flex hover:cursor-pointer"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
            <path d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z" />
          </svg>
        </button>
      </div>
    </section>
  );
}
