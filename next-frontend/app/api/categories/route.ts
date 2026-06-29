import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import type { Category } from "@/lib/api/contracts";

export async function GET(): Promise<NextResponse<Category[]>> {
  const res = await fetch(`${env.API_URL}/categories`, { cache: "no-store" });
  const data = (await res.json()) as Category[];
  return NextResponse.json(data, { status: res.status });
}
