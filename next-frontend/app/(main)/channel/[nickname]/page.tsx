import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import type { Channel, VideoListResponse } from "@/lib/api/contracts";
import { VideoGrid } from "@/components/videos/video-grid";
import { SubscribeButton } from "@/components/videos/subscribe-button";

interface ChannelPageProps {
  params: Promise<{ nickname: string }>;
  searchParams: Promise<{ page?: string }>;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default async function ChannelPage({ params, searchParams }: ChannelPageProps) {
  const { nickname } = await params;
  const { page } = await searchParams;
  const session = await getSession();

  const [channelRes, videosRes] = await Promise.all([
    fetch(`${env.API_URL}/channels/${nickname}`, { cache: "no-store" }),
    fetch(`${env.API_URL}/channels/${nickname}/videos?page=${page ?? 1}&limit=20`, { cache: "no-store" }),
  ]);

  if (!channelRes.ok) notFound();

  const channel = (await channelRes.json()) as Channel;
  const videoList = videosRes.ok
    ? ((await videosRes.json()) as VideoListResponse)
    : { data: [], total: 0, page: 1, limit: 20 };

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-h2">
          {channel.name[0].toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-h2">{channel.name}</h1>
          <p className="text-body-md text-muted-foreground">
            @{channel.nickname} · {formatCount(channel.subscribers_count)} subscribers · {videoList.total} videos
          </p>
          {channel.description && (
            <p className="text-body-md mt-1">{channel.description}</p>
          )}
        </div>
        <SubscribeButton
          nickname={nickname}
          initialSubscribed={false}
          initialCount={channel.subscribers_count}
          isLoggedIn={session.isLoggedIn}
        />
      </div>

      <div className="border-t border-border pt-4">
        <h2 className="text-h3 mb-4">Videos</h2>
        <VideoGrid videos={videoList.data} />

        {videoList.total > videoList.data.length && (
          <div className="flex justify-center pt-4">
            <a
              href={`/channel/${nickname}?page=${(Number(page ?? 1)) + 1}`}
              className="rounded-md border border-border px-4 py-2 text-label-md hover:bg-accent transition-colors"
            >
              Load more
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
