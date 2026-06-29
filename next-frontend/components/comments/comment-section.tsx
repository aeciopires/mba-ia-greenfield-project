"use client";

import { useState, useCallback } from "react";
import type { Comment, CreateCommentDto } from "@/lib/api/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface CommentCardProps {
  comment: Comment;
  videoSlug: string;
  isLoggedIn: boolean;
  onReplyAdded: (parentId: string, reply: Comment) => void;
}

function CommentCard({ comment, videoSlug, isLoggedIn, onReplyAdded }: CommentCardProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/comments/${comment.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText.trim() } satisfies CreateCommentDto),
      });
      if (res.ok) {
        const newReply = (await res.json()) as Comment;
        onReplyAdded(comment.id, newReply);
        setReplyText("");
        setShowReply(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  void videoSlug;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-label-md">
          {(comment.user?.email?.[0] ?? "?").toUpperCase()}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-label-md">{comment.user?.email ?? "User"}</span>
            <span className="text-caption text-muted-foreground">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-body-md">{comment.content}</p>
          {isLoggedIn && !comment.parent_id && (
            <button
              onClick={() => setShowReply(!showReply)}
              className="text-caption text-muted-foreground hover:text-foreground transition-colors"
            >
              Reply
            </button>
          )}
        </div>
      </div>

      {showReply && (
        <form onSubmit={(e) => { void submitReply(e); }} className="ml-11 flex gap-2">
          <Input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Add a reply..."
            className="flex-1"
            autoFocus
          />
          <Button type="submit" size="sm" disabled={!replyText.trim() || submitting}>Reply</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowReply(false)}>Cancel</Button>
        </form>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-11 flex flex-col gap-3 border-l border-border pl-4">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex gap-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-caption text-muted-foreground">
                {(reply.user?.email?.[0] ?? "?").toUpperCase()}
              </div>
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-label-md">{reply.user?.email ?? "User"}</span>
                  <span className="text-caption text-muted-foreground">{timeAgo(reply.created_at)}</span>
                </div>
                <p className="text-body-md">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface CommentSectionProps {
  videoSlug: string;
  initialComments: Comment[];
  initialTotal: number;
  isLoggedIn: boolean;
}

export function CommentSection({
  videoSlug,
  initialComments,
  initialTotal,
  isLoggedIn,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [total, setTotal] = useState(initialTotal);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/videos/${videoSlug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() } satisfies CreateCommentDto),
      });
      if (res.ok) {
        const comment = (await res.json()) as Comment;
        setComments((prev) => [comment, ...prev]);
        setTotal((t) => t + 1);
        setNewComment("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const handleReplyAdded = useCallback((parentId: string, reply: Comment) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === parentId
          ? { ...c, replies: [...(c.replies ?? []), reply] }
          : c,
      ),
    );
  }, []);

  return (
    <section className="space-y-4">
      <h2 className="text-h3">{total} Comments</h2>

      {isLoggedIn ? (
        <form onSubmit={(e) => { void submitComment(e); }} className="flex gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-label-md">
            U
          </div>
          <div className="flex-1 flex gap-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1"
            />
            <Button type="submit" size="sm" disabled={!newComment.trim() || submitting}>
              Post
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-body-md text-muted-foreground">
          <a href="/login" className="text-link hover:underline">Sign in</a> to comment.
        </p>
      )}

      <div className="flex flex-col gap-5">
        {comments.map((comment) => (
          <CommentCard
            key={comment.id}
            comment={comment}
            videoSlug={videoSlug}
            isLoggedIn={isLoggedIn}
            onReplyAdded={handleReplyAdded}
          />
        ))}
      </div>
    </section>
  );
}
