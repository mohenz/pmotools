"use client";

import { useRouter } from "next/navigation";

export function CalendarMineToggle({ checked, onHref, offHref, label="내 일정 보기" }: { checked: boolean; onHref: string; offHref: string; label?: string }) {
  const router = useRouter();
  return <label className="calendar-mine-toggle">
    <input type="checkbox" checked={checked} onChange={(e) => router.push(e.target.checked ? onHref : offHref)} />
    {label}
  </label>;
}
