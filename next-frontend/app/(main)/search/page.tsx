import { env } from "@/lib/env";
import type { VideoListResponse } from "@/lib/api/contracts";
import { VideoGrid } from "@/components/videos/video-grid";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, page } = await searchParams;

  if (!q?.trim()) {
    return (
      <div className="mx-auto max-w-screen-xl px-4 py-6">
        <p className="text-body-lg text-muted-foreground">Enter a search term above.</p>
      </div>
    );
  }

  const params = new URLSearchParams({ q, page: page ?? "1", limit: "20" });
  let videoList: VideoListResponse = { data: [], total: 0, page: 1, limit: 20 };

  try {
    const res = await fetch(`${env.API_URL}/videos?${params.toString()}`, { cache: "no-store" });
    if (res.ok) videoList = (await res.json()) as VideoListResponse;
  } catch {
    // network error — show empty state
  }

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6 space-y-4">
      <h1 className="text-h2">
        Results for <span className="text-primary">&ldquo;{q}&rdquo;</span>
        <span className="ml-2 text-body-lg text-muted-foreground">({videoList.total})</span>
      </h1>

      <VideoGrid videos={videoList.data} />

      {videoList.total > videoList.data.length && (
        <div className="flex justify-center pt-4">
          <a
            href={`/search?q=${encodeURIComponent(q)}&page=${(Number(page ?? 1)) + 1}`}
            className="rounded-md border border-border px-4 py-2 text-label-md hover:bg-accent transition-colors"
          >
            Load more
          </a>
        </div>
      )}
    </div>
  );
}
