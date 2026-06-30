import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";

type Params = { params: Promise<{ slug: string }> };

export async function GET(
  _request: NextRequest,
  { params }: Params,
): Promise<NextResponse<never>> {
  const { slug } = await params;
  const res = await fetch(`${env.API_URL}/videos/${slug}/thumbnail`, {
    redirect: "manual",
  });

  const location = res.headers.get("location");
  if (location) {
    return NextResponse.redirect(location, { status: 302 }) as NextResponse<never>;
  }

  return new NextResponse(null, { status: res.status }) as NextResponse<never>;
}

export async function POST(
  _request: NextRequest,
  { params }: Params,
): Promise<NextResponse<{ thumbnail_upload_url: string }>> {
  const { slug } = await params;
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" } as never, { status: 401 });
  }
  const res = await fetch(`${env.API_URL}/videos/${slug}/thumbnail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const data = (await res.json()) as { thumbnail_upload_url: string };
  return NextResponse.json(data, { status: res.status });
}
