"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

/** Top bar shown on authenticated pages. */
export function AppHeader() {
  const { data: session } = useSession();
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="font-semibold text-gray-900">
          Article Review Workspace
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {session?.user?.email && <span className="text-gray-500">{session.user.email}</span>}
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
