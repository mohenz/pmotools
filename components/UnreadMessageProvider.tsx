"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const POLL_INTERVAL_MS = 60_000;

const UnreadMessageContext = createContext<{ count: number; refresh: () => void } | null>(null);

export function UnreadMessageProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    if (!userId) return;
    fetch("/api/v1/messages/unread-count")
      .then((r) => r.json())
      .then((p) => setCount(p?.data?.count ?? 0))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!userId) { setCount(0); return; }
    refresh();
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [userId, refresh]);

  return <UnreadMessageContext.Provider value={{ count, refresh }}>{children}</UnreadMessageContext.Provider>;
}

export function useUnreadMessageCount() {
  const context = useContext(UnreadMessageContext);
  if (!context) throw new Error("useUnreadMessageCount는 UnreadMessageProvider 내부에서만 사용할 수 있습니다.");
  return context;
}
