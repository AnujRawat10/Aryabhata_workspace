import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";
import { AppHeader } from "~/components/AppHeader";
import { ProjectClient } from "./ProjectClient";

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/auth/signin");

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <ProjectClient projectId={params.projectId} />
      </main>
    </>
  );
}
