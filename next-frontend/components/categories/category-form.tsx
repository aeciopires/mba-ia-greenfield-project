"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/api/contracts";

interface CategoryFormProps {
  category?: Category;
}

export function CategoryForm({ category }: CategoryFormProps) {
  const router = useRouter();
  const isEditing = category !== undefined;

  const [name, setName] = useState(category?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const url = isEditing
      ? `/api/categories/${category.id}`
      : "/api/categories";
    const method = isEditing ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { message?: string | string[] };
        const msg = Array.isArray(body.message)
          ? body.message[0]
          : (body.message ?? "An error occurred");
        setError(msg);
        return;
      }

      router.push("/studio/categories");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="name" className="text-label-md block">
          Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Science & Technology"
          minLength={2}
          maxLength={100}
          required
          className="w-full rounded-[var(--radius-1)] border border-border bg-input-background px-3 py-2 text-body-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && (
        <p className="text-body-md text-destructive">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-4 py-2 text-label-md text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? "Saving…" : isEditing ? "Save changes" : "Create category"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/studio/categories")}
          className="text-label-md text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
