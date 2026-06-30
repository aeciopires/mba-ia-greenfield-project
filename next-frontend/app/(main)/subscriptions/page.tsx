import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import type { Channel } from "@/lib/api/contracts";

export default async function SubscriptionsPage() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.accessToken) redirect("/login");

  let channels: Channel[] = [];
  try {
    const res = await fetch(`${env.API_URL}/users/me/subscriptions`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    });
    if (res.ok) channels = (await res.json()) as Channel[];
  } catch {
    // show empty state
  }

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6 space-y-4">
      <h1 className="text-h2">Subscriptions</h1>

      {channels.length === 0 ? (
        <p className="text-body-lg text-muted-foreground">
          You haven&apos;t subscribed to any channels yet.{" "}
          <Link href="/" className="text-link hover:underline">Explore videos</Link>
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {channels.map((ch) => (
            <Link
              key={ch.id}
              href={`/channel/${ch.nickname}`}
              className="flex items-center gap-3 rounded-[var(--radius-2)] border border-border p-4 hover:bg-accent transition-colors"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-h3">
                {ch.name[0].toUpperCase()}
              </div>
              <div>
                <p className="text-label-lg">{ch.name}</p>
                <p className="text-caption text-muted-foreground">@{ch.nickname}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
