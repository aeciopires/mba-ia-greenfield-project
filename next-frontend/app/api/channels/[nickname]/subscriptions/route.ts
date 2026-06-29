import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";

type Params = { params: Promise<{ nickname: string }> };

export async function POST(
  _request: NextRequest,
  { params }: Params,
): Promise<NextResponse<{ subscribers_count: number }>> {
  const { nickname } = await params;
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" } as never, { status: 401 });
  }
  const res = await fetch(`${env.API_URL}/channels/${nickname}/subscriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const data = (await res.json()) as { subscribers_count: number };
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(
  _request: NextRequest,
  { params }: Params,
): Promise<NextResponse<{ subscribers_count: number }>> {
  const { nickname } = await params;
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" } as never, { status: 401 });
  }
  const res = await fetch(`${env.API_URL}/channels/${nickname}/subscriptions`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const data = (await res.json()) as { subscribers_count: number };
  return NextResponse.json(data, { status: res.status });
}
