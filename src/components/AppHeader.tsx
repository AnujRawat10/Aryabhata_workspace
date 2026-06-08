"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

/** Sticky top bar on authenticated pages. Responsive: email hides on mobile. */
export function AppHeader() {
  const { data: session } = useSession();
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img
            src="/logo_Aryabhattaapp.png"
            alt="Aryabhata Workspace logo"
            className="h-11 w-11 rounded"
          />
          <span className="text-base font-semibold text-gray-900 sm:text-lg">
            Aryabhata <span className="hidden text-gray-400 sm:inline">Workspace</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          {session?.user?.email && (
            <span className="hidden max-w-[160px] truncate text-sm text-gray-500 md:inline">
              {session.user.email}
            </span>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
