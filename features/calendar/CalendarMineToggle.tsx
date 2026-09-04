"use client";

import { useRouter } from "next/navigation";

export function CalendarMineToggle({ checked, onHref, offHref }: { checked: boolean; onHref: string; offHref: string }) {
  const router = useRouter();
  return <label className="calendar-mine-toggle">
    <input type="checkbox" checked={checked} onChange={(e) => router.push(e.target.checked ? onHref : offHref)} />
    내 일정 보기
  </label>;
}
