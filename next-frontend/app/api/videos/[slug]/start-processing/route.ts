import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import type { Video } from "@/lib/api/contracts";

type Params = { params: Promise<{ slug: string }> };

export async function PATCH(
  _request: NextRequest,
  { params }: Params,
): Promise<NextResponse<Video>> {
  const { slug } = await params;
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" } as never, { status: 401 });
  }
  const res = await fetch(`${env.API_URL}/videos/${slug}/start-processing`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const data = (await res.json()) as Video;
  return NextResponse.json(data, { status: res.status });
}
