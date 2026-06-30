import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import type { Category } from "@/lib/api/contracts";
import { CategoryDeleteButton } from "@/components/categories/category-delete-button";

export default async function StudioCategoriesPage() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.accessToken) {
    redirect("/login");
  }

  let categories: Category[] = [];
  try {
    const res = await fetch(`${env.API_URL}/categories`, { cache: "no-store" });
    if (res.ok) categories = (await res.json()) as Category[];
  } catch {
    // show empty state
  }

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-h2">Categories</h1>
        <Link
          href="/studio/categories/new"
          className="rounded-md bg-primary px-4 py-2 text-label-md text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          New category
        </Link>
      </div>

      {categories.length === 0 ? (
        <p className="text-body-lg text-muted-foreground">
          No categories yet. Create the first one!
        </p>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-2)] border border-border">
          <table className="w-full text-body-md">
            <thead className="border-b border-border bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-label-md">Name</th>
                <th className="px-4 py-3 text-left text-label-md">Slug</th>
                <th className="px-4 py-3 text-right text-label-md">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr
                  key={category.id}
                  className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                >
                  <td className="px-4 py-3 text-label-md">{category.name}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-caption">
                    {category.slug}
                  </td>
                  <td className="px-4 py-3 text-right space-x-4">
                    <Link
                      href={`/studio/categories/${category.id}`}
                      className="text-label-md text-link hover:underline"
                    >
                      Edit
                    </Link>
                    <CategoryDeleteButton id={category.id} name={category.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
