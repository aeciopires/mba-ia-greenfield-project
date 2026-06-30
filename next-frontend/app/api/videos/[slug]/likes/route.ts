import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import type { VoteSummary, VoteType } from "@/lib/api/contracts";

type Params = { params: Promise<{ slug: string }> };

export async function POST(
  request: NextRequest,
  { params }: Params,
): Promise<NextResponse<VoteSummary>> {
  const { slug } = await params;
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" } as never, { status: 401 });
  }
  const body = (await request.json()) as { type: VoteType };
  const res = await fetch(`${env.API_URL}/videos/${slug}/likes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as VoteSummary;
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(
  _request: NextRequest,
  { params }: Params,
): Promise<NextResponse<VoteSummary>> {
  const { slug } = await params;
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" } as never, { status: 401 });
  }
  const res = await fetch(`${env.API_URL}/videos/${slug}/likes`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const data = (await res.json()) as VoteSummary;
  return NextResponse.json(data, { status: res.status });
}
