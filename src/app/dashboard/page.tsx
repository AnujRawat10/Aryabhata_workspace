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
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Your workspaces</h1>
        <DashboardClient />
      </main>
    </>
  );
}
