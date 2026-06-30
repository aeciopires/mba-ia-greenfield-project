import type { Video } from "@/lib/api/contracts";
import { VideoCard } from "./video-card";
import { cn } from "@/lib/utils";

interface VideoGridProps {
  videos: Video[];
  className?: string;
}

export function VideoGrid({ videos, className }: VideoGridProps) {
  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p className="text-body-lg">No videos found</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
        className,
      )}
    >
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
