import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import type { Channel } from "@/lib/api/contracts";

export async function GET(_request: NextRequest): Promise<NextResponse<Channel[]>> {
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" } as never, { status: 401 });
  }
  const res = await fetch(`${env.API_URL}/users/me/subscriptions`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
  });
  const data = (await res.json()) as Channel[];
  return NextResponse.json(data, { status: res.status });
}
