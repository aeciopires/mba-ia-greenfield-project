"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Video, UpdateVideoDto, Category } from "@/lib/api/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  processing: "Processing",
  ready: "Ready",
  error: "Error",
};

export default function StudioVideoEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [video, setVideo] = useState<Video | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<UpdateVideoDto>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [vRes, cRes] = await Promise.all([
        fetch(`/api/videos/${id}`),
        fetch("/api/categories"),
      ]);
      if (!vRes.ok) { router.push("/studio/videos"); return; }
      const v = (await vRes.json()) as Video;
      const cats = cRes.ok ? ((await cRes.json()) as Category[]) : [];
      setVideo(v);
      setCategories(cats);
      setForm({
        title: v.title,
        description: v.description ?? "",
        category_id: v.category_id ?? "",
        visibility: v.visibility,
      });
      setLoading(false);
    }
    void load();
  }, [id, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!video) return;
    setSaving(true);
    setError(null);
    try {
      const body: UpdateVideoDto = {
        title: form.title,
        description: form.description ?? undefined,
        category_id: form.category_id || undefined,
        visibility: form.visibility,
      };
      const res = await fetch(`/api/videos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError("Failed to save. Please try again."); return; }
      router.push("/studio/videos");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!video) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${id}/publish`, { method: "PATCH" });
      if (!res.ok) { setError("Failed to publish."); return; }
      const updated = (await res.json()) as Video;
      setVideo(updated);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!video) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/studio/videos" className="text-muted-foreground hover:text-foreground transition-colors">
          ← Back
        </Link>
        <h1 className="text-h2">Edit Video</h1>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-caption ${video.status === "ready" ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
          {STATUS_LABELS[video.status] ?? video.status}
        </span>
      </div>

      <form onSubmit={(e) => { void handleSave(e); }} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={form.title ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={form.description ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={4}
            className="w-full rounded-[var(--radius-1)] border border-input bg-input-background px-3 py-2 text-body-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            value={form.category_id ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
            className="w-full rounded-[var(--radius-1)] border border-input bg-input-background px-3 py-2 text-body-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="visibility">Visibility</Label>
          <select
            id="visibility"
            value={form.visibility ?? "public"}
            onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value as "public" | "unlisted" }))}
            className="w-full rounded-[var(--radius-1)] border border-input bg-input-background px-3 py-2 text-body-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
          </select>
        </div>

        {error && <p className="text-caption text-destructive">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={saving}>Save changes</Button>
          {video.status === "ready" && !video.published_at && (
            <Button
              type="button"
              variant="outline"
              onClick={() => { void handlePublish(); }}
              disabled={saving}
            >
              Publish
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
