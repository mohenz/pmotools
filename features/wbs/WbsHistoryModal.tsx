"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { WbsItemEventRow } from "@/lib/server/wbs";

const eventLabels: Record<string, string> = { created: "등록", edited: "정보 수정", moved: "상위 항목 변경", status_changed: "상태 변경", archived: "보관" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(value));
}

function eventDescription(event: WbsItemEventRow) {
  const before = event.beforeData as { name?: string } | null;
  const after = event.afterData as { name?: string } | null;
  if (event.eventType === "edited" && before?.name && after?.name && before.name !== after.name) return `${before.name} → ${after.name}`;
  return event.body || "변경 기록";
}

export function WbsHistoryModal({ events }: { events: WbsItemEventRow[] }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className="button secondary" type="button" onClick={() => setOpen(true)}>이력 보기 ({events.length}건)</button>
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="calendar-modal-backdrop" />
        <Dialog.Content className="calendar-modal wbs-history-modal" aria-describedby={undefined}>
          <header><Dialog.Title asChild><h2>이력</h2></Dialog.Title><Dialog.Close asChild><button type="button" aria-label="창 닫기"><X aria-hidden="true" /></button></Dialog.Close></header>
          <div className="history-list">{events.length ? events.map((event) => <article className="history-item" key={event.id}><div><span className="badge">{eventLabels[event.eventType] ?? event.eventType}</span><time>{formatDate(event.createdAt)}</time></div><p>{eventDescription(event)}</p><small>{event.actorName}</small></article>) : <div className="empty">기록된 이력이 없습니다.</div>}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
