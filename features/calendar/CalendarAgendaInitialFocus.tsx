"use client";

import { useEffect } from "react";

export function CalendarAgendaInitialFocus({ targetId }: { targetId: string }) {
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (!target) return;

      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "start", inline: "nearest" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [targetId]);

  return null;
}
