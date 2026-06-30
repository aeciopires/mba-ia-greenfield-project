import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import type { VideoListResponse, InitiateUploadResponse, CreateVideoDto } from "@/lib/api/contracts";

export async function GET(request: NextRequest): Promise<NextResponse<VideoListResponse>> {
  const search = request.nextUrl.searchParams.toString();
  const url = search ? `${env.API_URL}/videos?${search}` : `${env.API_URL}/videos`;
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as VideoListResponse;
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: NextRequest): Promise<NextResponse<InitiateUploadResponse>> {
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" } as never, { status: 401 });
  }
  const body = (await request.json()) as CreateVideoDto;
  const res = await fetch(`${env.API_URL}/videos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as InitiateUploadResponse;
  return NextResponse.json(data, { status: res.status });
}
