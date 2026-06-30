import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import type { Category } from "@/lib/api/contracts";
import { CategoryForm } from "@/components/categories/category-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCategoryPage({ params }: Props) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.accessToken) {
    redirect("/login");
  }

  const { id } = await params;
  const res = await fetch(`${env.API_URL}/categories/${id}`, { cache: "no-store" });
  if (!res.ok) notFound();
  const category = (await res.json()) as Category;

  return (
    <div className="mx-auto max-w-screen-sm px-4 py-6 space-y-6">
      <h1 className="text-h2">Edit category</h1>
      <CategoryForm category={category} />
    </div>
  );
}
