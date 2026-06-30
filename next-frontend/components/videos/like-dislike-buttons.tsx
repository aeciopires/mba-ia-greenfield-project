"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { VoteType } from "@/lib/api/contracts";
import { cn } from "@/lib/utils";

interface LikeDislikeButtonsProps {
  slug: string;
  initialLikes: number;
  initialDislikes: number;
  initialUserVote: VoteType | null;
  isLoggedIn: boolean;
}

export function LikeDislikeButtons({
  slug,
  initialLikes,
  initialDislikes,
  initialUserVote,
  isLoggedIn,
}: LikeDislikeButtonsProps) {
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [userVote, setUserVote] = useState<VoteType | null>(initialUserVote);
  const [loading, setLoading] = useState(false);

  async function vote(type: VoteType) {
    if (!isLoggedIn) {
      window.location.href = "/login";
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/videos/${slug}/likes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        const data = (await res.json()) as { likes_count: number; dislikes_count: number; user_vote: VoteType | null };
        setLikes(data.likes_count);
        setDislikes(data.dislikes_count);
        setUserVote(data.user_vote);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { void vote("like"); }}
        disabled={loading}
        className={cn("gap-1.5", userVote === "like" && "text-primary")}
      >
        <svg className="size-4" fill={userVote === "like" ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905a3.61 3.61 0 01-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
        {likes}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { void vote("dislike"); }}
        disabled={loading}
        className={cn("gap-1.5", userVote === "dislike" && "text-destructive")}
      >
        <svg className="size-4" fill={userVote === "dislike" ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v2a2 2 0 002 2h.095c.5 0 .905-.405.905-.905a3.61 3.61 0 01.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
        </svg>
        {dislikes}
      </Button>
    </div>
  );
}
