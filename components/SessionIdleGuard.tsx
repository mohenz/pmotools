"use client";

import { useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import { SESSION_IDLE_TIMEOUT_MS } from "@/lib/domain/session";

const ACTIVITY_WRITE_INTERVAL_MS = 5_000;
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ["keydown", "pointerdown", "pointermove", "scroll", "touchstart"];

export function SessionIdleGuard() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;

    const activityKey = `pmotools:last-activity:${session.user.id}`;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let lastWrittenAt = 0;
    let signingOut = false;

    const forceSignOut = () => {
      if (signingOut) return;
      signingOut = true;
      try { localStorage.removeItem(activityKey); } catch { /* storage가 차단돼도 로그아웃은 수행한다. */ }
      void signOut({ callbackUrl: "/login?reason=idle" });
    };

    const scheduleSignOut = (lastActivityAt: number) => {
      if (timeoutId) clearTimeout(timeoutId);
      const remaining = SESSION_IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt);
      if (remaining <= 0) { forceSignOut(); return; }
      timeoutId = setTimeout(forceSignOut, remaining);
    };

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastWrittenAt < ACTIVITY_WRITE_INTERVAL_MS) return;
      lastWrittenAt = now;
      try { localStorage.setItem(activityKey, String(now)); } catch { /* 메모리 타이머로 계속 감지한다. */ }
      scheduleSignOut(now);
    };

    const syncActivity = (event: StorageEvent) => {
      if (event.key !== activityKey) return;
      if (event.newValue === null) { forceSignOut(); return; }
      const lastActivityAt = Number(event.newValue);
      if (Number.isFinite(lastActivityAt)) scheduleSignOut(lastActivityAt);
    };

    const checkWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      try {
        const stored = Number(localStorage.getItem(activityKey));
        if (Number.isFinite(stored) && stored > 0) scheduleSignOut(stored);
      } catch { /* 현재 타이머를 유지한다. */ }
    };

    recordActivity();
    for (const eventName of ACTIVITY_EVENTS) window.addEventListener(eventName, recordActivity, { passive: true });
    window.addEventListener("storage", syncActivity);
    document.addEventListener("visibilitychange", checkWhenVisible);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      for (const eventName of ACTIVITY_EVENTS) window.removeEventListener(eventName, recordActivity);
      window.removeEventListener("storage", syncActivity);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [session?.user?.id, status]);

  return null;
}
