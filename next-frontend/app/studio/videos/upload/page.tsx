"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Category, CreateVideoDto, InitiateUploadResponse, UpdateVideoDto, Video } from "@/lib/api/contracts";

type UploadStep = "idle" | "creating" | "uploading" | "processing" | "done" | "error";

const ACCEPTED_TYPES = "video/mp4,video/webm,video/ogg,video/quicktime";

export default function StudioVideoUploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [step, setStep] = useState<UploadStep>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCategories(data as Category[]))
      .catch(() => {/* show empty list */});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !title.trim()) return;

    setStep("creating");
    setErrorMsg(null);

    // 1. Create draft video and get presigned upload URL
    const createRes = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        content_type: file.type || "video/mp4",
      } satisfies CreateVideoDto),
    });

    if (!createRes.ok) {
      setErrorMsg("Failed to initiate upload. Please try again.");
      setStep("error");
      return;
    }

    const { video, presigned_upload_url } = (await createRes.json()) as InitiateUploadResponse;

    // 1b. Set category if selected (separate PATCH since CreateVideoDto has no category_id)
    if (categoryId) {
      await fetch(`/api/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: categoryId } satisfies UpdateVideoDto),
      });
    }

    // 2. Upload file directly to object storage via presigned URL
    setStep("uploading");
    setProgress(0);

    try {
      await uploadWithProgress(file, presigned_upload_url, setProgress);
    } catch {
      setErrorMsg("Upload failed. Please try again.");
      setStep("error");
      return;
    }

    // 3. Trigger video processing
    setStep("processing");
    const processRes = await fetch(`/api/videos/${video.id}/start-processing`, {
      method: "PATCH",
    });

    if (!processRes.ok) {
      setErrorMsg("Upload succeeded but processing could not be started. Go to My Videos to retry.");
      setStep("error");
      return;
    }

    const updated = (await processRes.json()) as Video;
    setStep("done");

    // Navigate to edit page so user can fill in metadata while video processes
    router.push(`/studio/videos/${updated.id}`);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/studio/videos" className="text-muted-foreground hover:text-foreground transition-colors">
          ← Back
        </Link>
        <h1 className="text-h2">Upload video</h1>
      </div>

      {step === "error" && errorMsg && (
        <p role="alert" className="rounded-[var(--radius-1)] border border-destructive/40 bg-destructive/10 px-4 py-3 text-body-md text-destructive">
          {errorMsg}
        </p>
      )}

      {(step === "idle" || step === "error") && (
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for your video"
              required
            />
          </div>

          {categories.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-[var(--radius-1)] border border-input bg-input-background px-3 py-2 text-body-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="file">Video file</Label>
            <input
              id="file"
              type="file"
              accept={ACCEPTED_TYPES}
              ref={fileRef}
              required
              className="block w-full text-body-md text-foreground file:mr-4 file:rounded-[var(--radius-1)] file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-label-md file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
            <p className="text-caption text-muted-foreground">MP4, WebM, OGG, or MOV</p>
          </div>

          <Button type="submit" size="md">
            Upload
          </Button>
        </form>
      )}

      {step === "creating" && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-body-lg text-muted-foreground">Preparing upload…</p>
        </div>
      )}

      {step === "uploading" && (
        <div className="flex flex-col gap-3 py-8">
          <p className="text-body-md text-muted-foreground text-center">
            Uploading… {progress}%
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-body-lg text-muted-foreground">Starting processing…</p>
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-body-lg">Upload complete! Redirecting…</p>
        </div>
      )}
    </div>
  );
}

function uploadWithProgress(
  file: File,
  url: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}
