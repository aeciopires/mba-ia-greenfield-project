"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { StreamTubeIcon } from "@/components/icons/streamtube-icon";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SessionContext } from "@/components/auth/session-provider";
import { use } from "react";
import { cn } from "@/lib/utils";

export function Header({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = use(SessionContext);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/");
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex h-14 items-center gap-4 border-b border-border bg-background px-4",
        className,
      )}
    >
      <Link href="/" className="flex shrink-0 items-center gap-2">
        <StreamTubeIcon className="h-7 w-7 text-primary" />
        <span className="hidden text-sm font-semibold sm:block">StreamTube</span>
      </Link>

      <form onSubmit={handleSearch} className="flex flex-1 max-w-xl mx-auto gap-2">
        <Input
          type="search"
          placeholder="Search videos..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
      </form>

      <nav className="flex shrink-0 items-center gap-2">
        <ThemeToggle />

        {session.isLoggedIn ? (
          <>
            <Link href="/studio/videos">
              <Button variant="outline" size="sm">Studio</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => { void logout(); }}>
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Sign up</Button>
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
