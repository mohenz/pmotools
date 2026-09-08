"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { SessionIdleGuard } from "@/components/SessionIdleGuard";

export function AuthSessionProvider({ children, session }: { children: React.ReactNode; session: Session | null }) {
  return (
    <SessionProvider session={session} refetchInterval={60} refetchOnWindowFocus>
      <SessionIdleGuard />
      {children}
    </SessionProvider>
  );
}
