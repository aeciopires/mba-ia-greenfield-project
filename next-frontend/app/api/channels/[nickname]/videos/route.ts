import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import type { VideoListResponse } from "@/lib/api/contracts";

type Params = { params: Promise<{ nickname: string }> };

export async function GET(
  request: NextRequest,
  { params }: Params,
): Promise<NextResponse<VideoListResponse>> {
  const { nickname } = await params;
  const search = request.nextUrl.searchParams.toString();
  const url = search
    ? `${env.API_URL}/channels/${nickname}/videos?${search}`
    : `${env.API_URL}/channels/${nickname}/videos`;
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as VideoListResponse;
  return NextResponse.json(data, { status: res.status });
}

export async function POST(
  request: NextRequest,
  { params }: Params,
): Promise<NextResponse<VideoListResponse>> {
  const { nickname } = await params;
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" } as never, { status: 401 });
  }
  const search = request.nextUrl.searchParams.toString();
  const url = search
    ? `${env.API_URL}/channels/${nickname}/studio/videos?${search}`
    : `${env.API_URL}/channels/${nickname}/studio/videos`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const data = (await res.json()) as VideoListResponse;
  return NextResponse.json(data, { status: res.status });
}
