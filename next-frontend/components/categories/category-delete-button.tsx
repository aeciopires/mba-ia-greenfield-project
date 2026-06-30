"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CategoryDeleteButtonProps {
  id: string;
  name: string;
}

export function CategoryDeleteButton({ id, name }: CategoryDeleteButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete category "${name}"? Videos using it will lose their category.`)) {
      return;
    }
    setDeleting(true);
    try {
      await fetch(`/api/categories/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-label-md text-destructive hover:underline disabled:opacity-50"
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
