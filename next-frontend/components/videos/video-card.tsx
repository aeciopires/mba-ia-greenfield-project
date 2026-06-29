import Link from "next/link";
import type { Video } from "@/lib/api/contracts";
import { cn } from "@/lib/utils";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

interface VideoCardProps {
  video: Video;
  className?: string;
}

export function VideoCard({ video, className }: VideoCardProps) {
  const duration = formatDuration(video.duration);

  return (
    <article className={cn("group flex flex-col gap-2", className)}>
      <Link href={`/watch/${video.slug}`} className="relative block aspect-video overflow-hidden rounded-[var(--radius-2)] bg-muted">
        {video.thumbnail_key ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/videos/${video.slug}/thumbnail`}
            alt={video.title}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <svg className="size-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}
        {duration && (
          <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1 text-xs font-medium">
            {duration}
          </span>
        )}
      </Link>

      <div className="flex flex-col gap-0.5 px-0.5">
        <Link href={`/watch/${video.slug}`}>
          <h3 className="text-label-md line-clamp-2 group-hover:text-primary transition-colors">
            {video.title}
          </h3>
        </Link>
        {video.channel && (
          <Link
            href={`/channel/${video.channel.nickname}`}
            className="text-caption text-muted-foreground hover:text-foreground transition-colors"
          >
            {video.channel.name}
          </Link>
        )}
        <p className="text-caption text-muted-foreground">
          {formatCount(video.view_count)} views · {timeAgo(video.created_at)}
        </p>
      </div>
    </article>
  );
}
