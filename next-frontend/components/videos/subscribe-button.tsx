"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SubscribeButtonProps {
  nickname: string;
  initialSubscribed: boolean;
  initialCount: number;
  isLoggedIn: boolean;
}

export function SubscribeButton({
  nickname,
  initialSubscribed,
  initialCount,
  isLoggedIn,
}: SubscribeButtonProps) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!isLoggedIn) {
      window.location.href = "/login";
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/channels/${nickname}/subscriptions`, {
        method: subscribed ? "DELETE" : "POST",
      });
      if (res.ok) {
        const data = (await res.json()) as { subscribers_count: number };
        setSubscribed(!subscribed);
        setCount(data.subscribers_count);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={subscribed ? "outline" : "default"}
      size="sm"
      onClick={() => { void toggle(); }}
      disabled={loading}
      className={cn(loading && "opacity-60")}
    >
      {subscribed ? "Subscribed" : "Subscribe"}
      {count > 0 && <span className="ml-1.5 text-muted-foreground">· {count}</span>}
    </Button>
  );
}
