import { http, HttpResponse } from "msw";

import type { paths } from "@/lib/api/types.gen";
import { env } from "@/lib/env";

type MyChannelOk =
  paths["/channels/me"]["get"]["responses"][200]["content"]["application/json"];

export const handlers = [
  // GET /channels/me — returns the authenticated user's own channel
  http.get(`${env.API_URL}/channels/me`, () =>
    HttpResponse.json<MyChannelOk>({
      id: "channel-fixture-id",
      name: "fixture-channel",
      nickname: "fixture-channel",
      description: null,
      user_id: "user-fixture-id",
      subscribers_count: 0,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    }),
  ),
];
