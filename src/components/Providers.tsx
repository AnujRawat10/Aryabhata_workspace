"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import { TRPCReactProvider } from "~/trpc/react";

/** Wraps the whole app in auth, tRPC/React-Query, and toast providers. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TRPCReactProvider>
        {children}
        <Toaster position="bottom-right" />
      </TRPCReactProvider>
    </SessionProvider>
  );
}
