import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";
import { AppHeader } from "~/components/AppHeader";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/auth/signin");

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Your workspaces</h1>
          <p className="mt-1 text-sm text-gray-500">
            Organizations and projects you belong to. Open a project to import and review articles.
          </p>
        </div>
        <DashboardClient />
      </main>
    </>
  );
}
