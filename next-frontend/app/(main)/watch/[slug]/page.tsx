import { notFound } from "next/navigation";
import Link from "next/link";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import type { Video, CommentListResponse } from "@/lib/api/contracts";
import { VideoPlayer } from "@/components/videos/video-player";
import { LikeDislikeButtons } from "@/components/videos/like-dislike-buttons";
import { SubscribeButton } from "@/components/videos/subscribe-button";
import { CommentSection } from "@/components/comments/comment-section";
import { VideoCard } from "@/components/videos/video-card";

interface WatchPageProps {
  params: Promise<{ slug: string }>;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default async function WatchPage({ params }: WatchPageProps) {
  const { slug } = await params;
  const session = await getSession();

  const [videoRes, commentsRes, suggestionsRes] = await Promise.all([
    fetch(`${env.API_URL}/videos/${slug}`, { cache: "no-store" }),
    fetch(`${env.API_URL}/videos/${slug}/comments?limit=20`, { cache: "no-store" }),
    fetch(`${env.API_URL}/videos/${slug}/suggestions`, { cache: "no-store" }),
  ]);

  if (!videoRes.ok) notFound();

  const video = (await videoRes.json()) as Video;
  const comments = commentsRes.ok ? ((await commentsRes.json()) as CommentListResponse) : { data: [], total: 0 };
  const suggestions = suggestionsRes.ok ? ((await suggestionsRes.json()) as Video[]) : [];

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <VideoPlayer slug={slug} />

          <div className="space-y-2">
            <h1 className="text-h2">{video.title}</h1>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {video.channel && (
                  <Link href={`/channel/${video.channel.nickname}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <div className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-label-md">
                      {video.channel.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-label-md">{video.channel.name}</p>
                      <p className="text-caption text-muted-foreground">
                        {formatCount(video.channel.subscribers_count)} subscribers
                      </p>
                    </div>
                  </Link>
                )}
                {video.channel && (
                  <SubscribeButton
                    nickname={video.channel.nickname}
                    initialSubscribed={false}
                    initialCount={video.channel.subscribers_count}
                    isLoggedIn={session.isLoggedIn}
                  />
                )}
              </div>

              <LikeDislikeButtons
                slug={slug}
                initialLikes={video.likes_count}
                initialDislikes={video.dislikes_count}
                initialUserVote={null}
                isLoggedIn={session.isLoggedIn}
              />
            </div>

            {video.description && (
              <div className="rounded-[var(--radius-2)] bg-muted p-4">
                <p className="text-body-md whitespace-pre-wrap">{video.description}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 text-caption text-muted-foreground">
              <span>{formatCount(video.view_count)} views</span>
              {video.category && (
                <span className="rounded-full bg-muted px-2 py-0.5">{video.category.name}</span>
              )}
            </div>
          </div>

          <CommentSection
            videoSlug={slug}
            initialComments={comments.data}
            initialTotal={comments.total}
            isLoggedIn={session.isLoggedIn}
          />
        </div>

        {suggestions.length > 0 && (
          <aside className="flex flex-col gap-3">
            <h2 className="text-label-xl">Suggested</h2>
            {suggestions.map((v) => (
              <VideoCard key={v.id} video={v} className="flex-row gap-3 [&_.aspect-video]:w-40 [&_.aspect-video]:shrink-0" />
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}
