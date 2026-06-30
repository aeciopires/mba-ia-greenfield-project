import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import type { Video } from "@/lib/api/contracts";
import { env } from "@/lib/env";

type Params = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: Params,
): Promise<NextResponse<Video | { error: string }>> {
  const { id } = await params;
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const res = await fetch(`${env.API_URL}/videos/${id}/studio`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
  });
  const data = (await res.json()) as Video;
  return NextResponse.json(data, { status: res.status });
}
