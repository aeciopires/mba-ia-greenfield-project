"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/lib/api/contracts";
import { cn } from "@/lib/utils";

interface CategoryChipsProps {
  categories: Category[];
}

export function CategoryChips({ categories }: CategoryChipsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("category_id");

  function select(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) {
      params.set("category_id", id);
    } else {
      params.delete("category_id");
    }
    params.delete("page");
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none">
      <button
        onClick={() => select(null)}
        className={cn(
          "shrink-0 rounded-full px-3 py-1 text-label-md transition-colors",
          !activeId
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => select(cat.id)}
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-label-md transition-colors",
            activeId === cat.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
