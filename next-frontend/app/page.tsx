import { Suspense } from "react";
import type { Category, VideoListResponse } from "@/lib/api/contracts";
import { CategoryChips } from "@/components/videos/category-chips";
import { VideoGrid } from "@/components/videos/video-grid";
import { env } from "@/lib/env";

interface HomePageProps {
  searchParams: Promise<{
    category_id?: string;
    page?: string;
    q?: string;
  }>;
}

async function fetchCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${env.API_URL}/categories`, { cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as Category[];
  } catch {
    return [];
  }
}

async function fetchVideos(params: Record<string, string>): Promise<VideoListResponse> {
  const query = new URLSearchParams(params).toString();
  const url = query ? `${env.API_URL}/videos?${query}` : `${env.API_URL}/videos`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { data: [], total: 0, page: 1, limit: 20 };
    return (await res.json()) as VideoListResponse;
  } catch {
    return { data: [], total: 0, page: 1, limit: 20 };
  }
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const { category_id, page, q } = params;

  const [categories, videoList] = await Promise.all([
    fetchCategories(),
    fetchVideos({
      ...(category_id ? { category_id } : {}),
      ...(q ? { q } : {}),
      page: page ?? "1",
      limit: "20",
    }),
  ]);

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6 space-y-4">
      {q ? (
        <h1 className="text-h2">
          Results for <span className="text-primary">&ldquo;{q}&rdquo;</span>
        </h1>
      ) : (
        <Suspense fallback={null}>
          <CategoryChips categories={categories} />
        </Suspense>
      )}

      <VideoGrid videos={videoList.data} />

      {videoList.total > videoList.data.length && (
        <div className="flex justify-center pt-4">
          <a
            href={`/?page=${(Number(page ?? 1)) + 1}${category_id ? `&category_id=${category_id}` : ""}${q ? `&q=${q}` : ""}`}
            className="rounded-md border border-border px-4 py-2 text-label-md hover:bg-accent transition-colors"
          >
            Load more
          </a>
        </div>
      )}
    </div>
  );
}
