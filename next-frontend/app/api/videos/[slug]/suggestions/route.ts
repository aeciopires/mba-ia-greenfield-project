import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import type { Video } from "@/lib/api/contracts";

type Params = { params: Promise<{ slug: string }> };

export async function GET(
  _request: NextRequest,
  { params }: Params,
): Promise<NextResponse<Video[]>> {
  const { slug } = await params;
  const res = await fetch(`${env.API_URL}/videos/${slug}/suggestions`, { cache: "no-store" });
  const data = (await res.json()) as Video[];
  return NextResponse.json(data, { status: res.status });
}
