import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import type { Video, VideoListResponse } from "@/lib/api/contracts";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  processing: "Processing",
  ready: "Ready",
  error: "Error",
};

const STATUS_CLASSES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  processing: "bg-warning/20 text-warning",
  ready: "bg-success/20 text-success",
  error: "bg-destructive/20 text-destructive",
};

interface StudioVideosPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function StudioVideosPage({ searchParams }: StudioVideosPageProps) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.accessToken || !session.channelSlug) {
    redirect("/login");
  }

  const { page } = await searchParams;

  let videoList: VideoListResponse = { data: [], total: 0, page: 1, limit: 20 };
  try {
    const res = await fetch(
      `${env.API_URL}/channels/${session.channelSlug}/studio/videos?page=${page ?? 1}&limit=20`,
      {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store",
      },
    );
    if (res.ok) videoList = (await res.json()) as VideoListResponse;
  } catch {
    // show empty state
  }

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-h2">My Videos</h1>
        <Link
          href="/studio/videos/upload"
          className="rounded-md bg-primary px-4 py-2 text-label-md text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Upload video
        </Link>
      </div>

      {videoList.data.length === 0 ? (
        <p className="text-body-lg text-muted-foreground">No videos yet. Upload your first video!</p>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-2)] border border-border">
          <table className="w-full text-body-md">
            <thead className="border-b border-border bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-label-md">Title</th>
                <th className="px-4 py-3 text-left text-label-md">Status</th>
                <th className="px-4 py-3 text-left text-label-md">Views</th>
                <th className="px-4 py-3 text-left text-label-md">Published</th>
                <th className="px-4 py-3 text-right text-label-md">Actions</th>
              </tr>
            </thead>
            <tbody>
              {videoList.data.map((video: Video) => (
                <tr key={video.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/studio/videos/${video.id}`}
                      className="text-label-md hover:text-primary transition-colors line-clamp-1"
                    >
                      {video.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-caption ${STATUS_CLASSES[video.status] ?? ""}`}>
                      {STATUS_LABELS[video.status] ?? video.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{video.view_count}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {video.published_at
                      ? new Date(video.published_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/studio/videos/${video.id}`}
                      className="text-label-md text-link hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
