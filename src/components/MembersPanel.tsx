"use client";

import { useState } from "react";
import { LoadingSkeleton, ErrorState } from "~/components/ui/States";

export type Member = {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string };
};

/**
 * Presentational panel that lists members and (for owners) shows an "add by
 * email" form. The parent wires up the tRPC query/mutation and passes them in,
 * so this component stays dumb and reusable for both orgs and projects.
 */
export function MembersPanel({
  members,
  isLoading,
  isError,
  onRetry,
  canManage,
  roleOptions,
  onAdd,
  isAdding,
}: {
  members?: Member[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  canManage: boolean;
  roleOptions: { value: string; label: string }[];
  onAdd: (email: string, role: string) => void;
  isAdding: boolean;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roleOptions[0]!.value);

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h4 className="mb-2 text-sm font-semibold text-gray-700">Members</h4>

      {isLoading ? (
        <LoadingSkeleton rows={2} />
      ) : isError ? (
        <ErrorState message="Couldn't load members." onRetry={onRetry} />
      ) : (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {members?.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{m.user.name ?? m.user.email}</span>{" "}
                <span className="text-gray-400">{m.user.email}</span>
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {m.role}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim()) return;
            onAdd(email.trim(), role);
            setEmail("");
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@email.com"
            className="min-w-[200px] flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {roleOptions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isAdding}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isAdding ? "Adding…" : "Add member"}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-gray-400">Only owners can add members.</p>
      )}
      <p className="mt-2 text-xs text-gray-400">
        The person must already have an account (they can sign up first).
      </p>
    </div>
  );
}
