"use client";

import toast from "react-hot-toast";
import { api } from "~/trpc/react";
import { MembersPanel } from "~/components/MembersPanel";

/** Member management for a project. Owners can add REVIEWER or OWNER. */
export function ProjectMembers({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const utils = api.useUtils();
  const members = api.project.listMembers.useQuery({ projectId });

  const addMember = api.project.addMember.useMutation({
    onSuccess: async () => {
      toast.success("Member added.");
      await utils.project.listMembers.invalidate({ projectId });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <MembersPanel
      members={members.data}
      isLoading={members.isLoading}
      isError={members.isError}
      onRetry={() => members.refetch()}
      canManage={canManage}
      roleOptions={[
        { value: "REVIEWER", label: "Reviewer" },
        { value: "OWNER", label: "Owner" },
      ]}
      onAdd={(email, role) =>
        addMember.mutate({ projectId, email, role: role as "REVIEWER" | "OWNER" })
      }
      isAdding={addMember.isPending}
    />
  );
}
