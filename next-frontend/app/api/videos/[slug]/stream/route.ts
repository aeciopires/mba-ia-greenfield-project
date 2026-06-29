import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

type Params = { params: Promise<{ slug: string }> };

export async function GET(
  _request: NextRequest,
  { params }: Params,
): Promise<NextResponse<never>> {
  const { slug } = await params;
  const res = await fetch(`${env.API_URL}/videos/${slug}/stream`, {
    redirect: "manual",
  });

  const location = res.headers.get("location");
  if (location) {
    return NextResponse.redirect(location, { status: 302 }) as NextResponse<never>;
  }

  return new NextResponse(null, { status: res.status }) as NextResponse<never>;
}
