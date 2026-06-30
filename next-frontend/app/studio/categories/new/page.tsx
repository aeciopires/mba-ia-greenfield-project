import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { CategoryForm } from "@/components/categories/category-form";

export default async function NewCategoryPage() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.accessToken) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-screen-sm px-4 py-6 space-y-6">
      <h1 className="text-h2">New category</h1>
      <CategoryForm />
    </div>
  );
}
