"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, MapPin, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import type { CalendarInvitationNotice } from "@/lib/server/calendar-invitations";
import { useUnreadMessageCount } from "@/components/UnreadMessageProvider";

function dateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function periodOf(notice: CalendarInvitationNotice) {
  const { invitation } = notice;
  const date = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" }).format(new Date(invitation.startAt));
  if (invitation.allDay) return `${date} · 종일`;
  const time = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Seoul" });
  return `${date} ${time.format(new Date(invitation.startAt))}–${time.format(new Date(invitation.endAt))}`;
}

export function CalendarInvitationPopup() {
  const router = useRouter();
  const { data: session } = useSession();
  const { refresh: refreshUnreadCount } = useUnreadMessageCount();
  const userId = session?.user?.id;
  const [invitations, setInvitations] = useState<CalendarInvitationNotice[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    fetch("/api/v1/calendar-invitations", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        const rows = Array.isArray(payload?.data) ? payload.data as CalendarInvitationNotice[] : [];
        setInvitations(rows);
        setOpen(rows.length > 0);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [userId]);

  async function acknowledge() {
    if (!invitations.length) { setOpen(false); return; }
    setPending(true);
    const response = await fetch("/api/v1/calendar-invitations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageIds: invitations.map((item) => item.messageId) }),
    });
    setPending(false);
    if (!response.ok) return;
    setOpen(false);
    refreshUnreadCount();
  }

  async function openCalendar(notice: CalendarInvitationNotice) {
    await acknowledge();
    if (!notice.calendarEventId) return;
    router.push(`/calendar?view=day&date=${dateKey(notice.invitation.startAt)}&edit=${encodeURIComponent(notice.calendarEventId)}`);
  }

  if (!invitations.length) return null;

  return <Dialog.Root open={open} onOpenChange={(next) => { if (!next && !pending) void acknowledge(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="calendar-modal-backdrop" />
      <Dialog.Content className="calendar-invitation-modal">
        <header>
          <div><Dialog.Title>초청받은 일정</Dialog.Title><Dialog.Description>담당자로 지정된 새 일정 {invitations.length}건입니다.</Dialog.Description></div>
          <button type="button" aria-label="초청 일정 창 닫기" onClick={() => void acknowledge()} disabled={pending}><X aria-hidden="true" /></button>
        </header>
        <div className="calendar-invitation-list">
          {invitations.map((notice) => <article key={notice.messageId}>
            <div className="calendar-invitation-icon"><CalendarDays aria-hidden="true" /></div>
            <div>
              <strong>{notice.invitation.title}{notice.invitation.isRecurring && " · 반복"}</strong>
              <p>{periodOf(notice)}</p>
              {notice.invitation.location && <small><MapPin aria-hidden="true" />{notice.invitation.location}</small>}
              <small>초청자: {notice.senderName} ({notice.senderUserId})</small>
            </div>
            {notice.calendarEventId && <button className="button secondary small" type="button" onClick={() => void openCalendar(notice)} disabled={pending}>일정 보기</button>}
          </article>)}
        </div>
        <footer><button className="button primary" type="button" onClick={() => void acknowledge()} disabled={pending}>{pending ? "확인 중…" : "모두 확인"}</button></footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
