import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import type { Comment, CreateCommentDto } from "@/lib/api/contracts";

type Params = { params: Promise<{ id: string }> };

export async function POST(
  request: NextRequest,
  { params }: Params,
): Promise<NextResponse<Comment>> {
  const { id } = await params;
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" } as never, { status: 401 });
  }
  const body = (await request.json()) as CreateCommentDto;
  const res = await fetch(`${env.API_URL}/comments/${id}/replies`, {
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
