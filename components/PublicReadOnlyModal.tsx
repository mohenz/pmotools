"use client";

import { useEffect } from "react";

type PublicView = "calendar" | "meetrooms";

const VIEW_CONFIG: Record<PublicView, { label: string; src: string }> = {
  calendar: { label: "캘린더", src: "/calendar?embedded=1" },
  meetrooms: { label: "회의실 예약현황", src: "/meetrooms?embedded=1" },
};

export function PublicReadOnlyModal({ view, onClose }: { view: PublicView; onClose: () => void }) {
  const config = VIEW_CONFIG[view];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div className="public-view-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="public-view-modal" role="dialog" aria-modal="true" aria-label={config.label}>
        <button className="public-view-modal-close" type="button" aria-label="닫기" onClick={onClose}>×</button>
        <iframe src={config.src} title={config.label} />
      </section>
    </div>
  );
}
