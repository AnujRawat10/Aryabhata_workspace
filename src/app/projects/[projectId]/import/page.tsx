import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";
import { AppHeader } from "~/components/AppHeader";
import { ImportClient } from "./ImportClient";

export default async function ImportPage({ params }: { params: { projectId: string } }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/auth/signin");

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <ImportClient projectId={params.projectId} />
      </main>
    </>
  );
}
