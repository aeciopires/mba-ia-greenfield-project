import { NextResponse } from "next/server";

import type { LoginDto, LoginTokenPair, MyChannel, ApiErrorEnvelope } from "@/lib/api/contracts";
import { upstream } from "@/lib/api/upstream";
import { setSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = (await request.json()) as LoginDto;

  const { data, error, response } = await upstream.POST("/auth/login", {
    body: body as never,
  });

  if (error) {
    return NextResponse.json<ApiErrorEnvelope>(error as ApiErrorEnvelope, {
      status: response.status,
    });
  }

  const tokens = data as LoginTokenPair;
  const accessToken = tokens.access_token ?? "";
  const refreshToken = tokens.refresh_token ?? "";

  // Decode the JWT payload (no verification needed — we just received it from
  // the auth server). Extract the subject claim (userId).
  let userId = "";
  try {
    const [, payloadB64] = accessToken.split(".");
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    ) as { sub?: string };
    userId = payload.sub ?? "";
  } catch {
    // leave userId empty if the token is malformed
  }

  // Fetch the user's own channel to populate channelSlug in the session.
  const { data: channelData } = await upstream.GET("/channels/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const channel = channelData as MyChannel | undefined;

  await setSession({
    accessToken,
    refreshToken,
    userId,
    email: (body as Record<string, string>).email ?? "",
    channelSlug: channel?.nickname ?? "",
  });

  return NextResponse.json({}, { status: 200 });
}
