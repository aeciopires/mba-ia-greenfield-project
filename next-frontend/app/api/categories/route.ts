import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import type { Category } from "@/lib/api/contracts";

export async function GET(): Promise<NextResponse<Category[]>> {
  const res = await fetch(`${env.API_URL}/categories`, { cache: "no-store" });
  const data = (await res.json()) as Category[];
  return NextResponse.json(data, { status: res.status });
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<Category>> {
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" } as never, { status: 401 });
  }
  const body = (await request.json()) as { name: string };
  const res = await fetch(`${env.API_URL}/categories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Category;
  return NextResponse.json(data, { status: res.status });
}
