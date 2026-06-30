import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import type { Comment, CommentListResponse, CreateCommentDto } from "@/lib/api/contracts";

type Params = { params: Promise<{ slug: string }> };

export async function GET(
  request: NextRequest,
  { params }: Params,
): Promise<NextResponse<CommentListResponse>> {
  const { slug } = await params;
  const search = request.nextUrl.searchParams.toString();
  const url = search
    ? `${env.API_URL}/videos/${slug}/comments?${search}`
    : `${env.API_URL}/videos/${slug}/comments`;
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as CommentListResponse;
  return NextResponse.json(data, { status: res.status });
}

export async function POST(
  request: NextRequest,
  { params }: Params,
): Promise<NextResponse<Comment>> {
  const { slug } = await params;
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" } as never, { status: 401 });
  }
  const body = (await request.json()) as CreateCommentDto;
  const res = await fetch(`${env.API_URL}/videos/${slug}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Comment;
  return NextResponse.json(data, { status: res.status });
}
