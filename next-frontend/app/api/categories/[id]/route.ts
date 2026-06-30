import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import type { Category } from "@/lib/api/contracts";

type Params = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: Params,
): Promise<NextResponse<Category>> {
  const { id } = await params;
  const res = await fetch(`${env.API_URL}/categories/${id}`, { cache: "no-store" });
  const data = (await res.json()) as Category;
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(
  request: NextRequest,
  { params }: Params,
): Promise<NextResponse<Category>> {
  const { id } = await params;
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" } as never, { status: 401 });
  }
  const body = (await request.json()) as { name?: string };
  const res = await fetch(`${env.API_URL}/categories/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Category;
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(
  _request: NextRequest,
  { params }: Params,
): Promise<NextResponse<never>> {
  const { id } = await params;
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" } as never, { status: 401 });
  }
  const res = await fetch(`${env.API_URL}/categories/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (res.status === 204) {
    return new NextResponse(null, { status: 204 }) as NextResponse<never>;
  }
  const data = (await res.json()) as never;
  return NextResponse.json(data, { status: res.status });
}
