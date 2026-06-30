"use client";

import { useEffect, useRef } from "react";

interface VideoPlayerProps {
  slug: string;
}

export function VideoPlayer({ slug }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const counted = useRef(false);

  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    void fetch(`/api/videos/${slug}/views`, { method: "POST" });
  }, [slug]);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-[var(--radius-2)] bg-black">
      <video
        ref={videoRef}
        className="h-full w-full"
        controls
        preload="metadata"
        src={`/api/videos/${slug}/stream`}
      />
    </div>
  );
}
