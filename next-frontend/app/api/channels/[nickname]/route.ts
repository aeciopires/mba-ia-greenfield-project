import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import type { Channel, UpdateChannelDto } from "@/lib/api/contracts";

type Params = { params: Promise<{ nickname: string }> };

export async function GET(
  _request: NextRequest,
  { params }: Params,
): Promise<NextResponse<Channel>> {
  const { nickname } = await params;
  const res = await fetch(`${env.API_URL}/channels/${nickname}`, { cache: "no-store" });
  const data = (await res.json()) as Channel;
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(
  request: NextRequest,
  { params }: Params,
): Promise<NextResponse<Channel>> {
  const { nickname } = await params;
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" } as never, { status: 401 });
  }
  const body = (await request.json()) as UpdateChannelDto;
  const res = await fetch(`${env.API_URL}/channels/${nickname}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Channel;
  return NextResponse.json(data, { status: res.status });
}
