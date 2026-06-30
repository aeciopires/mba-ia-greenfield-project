import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

type Params = { params: Promise<{ slug: string }> };

export async function POST(
  _request: NextRequest,
  { params }: Params,
): Promise<NextResponse<never>> {
  const { slug } = await params;
  const res = await fetch(`${env.API_URL}/videos/${slug}/views`, {
    method: "POST",
  });
  return new NextResponse(null, { status: res.status }) as NextResponse<never>;
}
