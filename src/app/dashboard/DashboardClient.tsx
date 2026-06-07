"use client";

import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "~/trpc/react";
import { EmptyState, ErrorState, LoadingSkeleton } from "~/components/ui/States";
import { OrgMembers } from "~/components/OrgMembers";

export function DashboardClient() {
  const orgs = api.organization.list.useQuery();
  const utils = api.useUtils();
  const [newProjectFor, setNewProjectFor] = useState<string | null>(null);
  const [membersFor, setMembersFor] = useState<string | null>(null);

  const createProject = api.project.create.useMutation({
    onSuccess: async () => {
      toast.success("Project created.");
      setNewProjectFor(null);
      await utils.organization.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (orgs.isLoading) return <LoadingSkeleton rows={4} />;
  if (orgs.isError) return <ErrorState message={orgs.error.message} onRetry={() => orgs.refetch()} />;
  if (!orgs.data || orgs.data.length === 0) {
    return (
      <EmptyState
        title="No organizations yet"
        message="You are not a member of any organization. Ask an owner to add you, or run the seed script to create the demo workspace."
      />
    );
  }

  return (
    <div className="space-y-8">
      {orgs.data.map(({ organization, role }) => (
        <section key={organization.id} className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">{organization.name}</h2>
              <span className="text-xs uppercase tracking-wide text-gray-400">Your role: {role}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setMembersFor((cur) => (cur === organization.id ? null : organization.id))
                }
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                {membersFor === organization.id ? "Hide members" : "Members"}
              </button>
              {role === "OWNER" && (
                <button
                  onClick={() => setNewProjectFor(organization.id)}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  New project
                </button>
              )}
            </div>
          </div>

          {membersFor === organization.id && (
            <OrgMembers organizationId={organization.id} canManage={role === "OWNER"} />
          )}

          {newProjectFor === organization.id && (
            <form
              className="mb-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const name = new FormData(e.currentTarget).get("name") as string;
                if (name?.trim()) createProject.mutate({ organizationId: organization.id, name });
              }}
            >
              <input
                name="name"
                placeholder="Project name"
                autoFocus
                className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
              <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white" type="submit">
                Create
              </button>
              <button
                type="button"
                onClick={() => setNewProjectFor(null)}
                className="rounded-md border px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
            </form>
          )}

          {organization.projects.length === 0 ? (
            <p className="text-sm text-gray-500">No projects yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {organization.projects.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <Link href={`/projects/${p.id}`} className="font-medium text-blue-600 hover:underline">
                    {p.name}
                  </Link>
                  <span className="text-sm text-gray-500">{p._count.articles} articles</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
