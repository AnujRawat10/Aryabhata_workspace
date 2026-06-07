"use client";

import toast from "react-hot-toast";
import { api } from "~/trpc/react";
import { MembersPanel } from "~/components/MembersPanel";

/** Member management for an organization. Owners can add MEMBER or OWNER. */
export function OrgMembers({
  organizationId,
  canManage,
}: {
  organizationId: string;
  canManage: boolean;
}) {
  const utils = api.useUtils();
  const members = api.organization.listMembers.useQuery({ organizationId });

  const addMember = api.organization.addMember.useMutation({
    onSuccess: async () => {
      toast.success("Member added.");
      await utils.organization.listMembers.invalidate({ organizationId });
      await utils.organization.list.invalidate();
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
        { value: "MEMBER", label: "Member" },
        { value: "OWNER", label: "Owner" },
      ]}
      onAdd={(email, role) =>
        addMember.mutate({ organizationId, email, role: role as "MEMBER" | "OWNER" })
      }
      isAdding={addMember.isPending}
    />
  );
}
