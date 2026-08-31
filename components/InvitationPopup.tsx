"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { MapPin, X } from "lucide-react";
import { CalendarIcon, TeamIcon } from "@/components/icons/PmoIcons";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import type { CalendarInvitationNotice } from "@/lib/server/calendar-invitations";
import type { MeetingInvitationNotice } from "@/lib/server/meeting-invitations";
import { useUnreadMessageCount } from "@/components/UnreadMessageProvider";

type Notice =
  | { kind: "calendar"; notice: CalendarInvitationNotice }
  | { kind: "meeting"; notice: MeetingInvitationNotice };

function dateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function periodOf(startAt: string, endAt: string, allDay: boolean) {
  const date = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" }).format(new Date(startAt));
  if (allDay) return `${date} · 종일`;
  const time = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Seoul" });
  return `${date} ${time.format(new Date(startAt))}–${time.format(new Date(endAt))}`;
}

export function InvitationPopup() {
  const router = useRouter();
  const { data: session } = useSession();
  const { refresh: refreshUnreadCount } = useUnreadMessageCount();
  const userId = session?.user?.id;
  const [items, setItems] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    Promise.all([
      fetch("/api/v1/calendar-invitations", { signal: controller.signal }).then((response) => response.ok ? response.json() : null).catch(() => null),
      fetch("/api/v1/meeting-invitations", { signal: controller.signal }).then((response) => response.ok ? response.json() : null).catch(() => null),
    ]).then(([calendarPayload, meetingPayload]) => {
      const calendarNotices: Notice[] = (Array.isArray(calendarPayload?.data) ? calendarPayload.data as CalendarInvitationNotice[] : []).map((notice) => ({ kind: "calendar", notice }));
      const meetingNotices: Notice[] = (Array.isArray(meetingPayload?.data) ? meetingPayload.data as MeetingInvitationNotice[] : []).map((notice) => ({ kind: "meeting", notice }));
      const merged = [...calendarNotices, ...meetingNotices].sort((a, b) => b.notice.createdAt.localeCompare(a.notice.createdAt));
      setItems(merged);
      setOpen(merged.length > 0);
    });
    return () => controller.abort();
  }, [userId]);

  async function acknowledge() {
    if (!items.length) { setOpen(false); return; }
    setPending(true);
    const calendarIds = items.filter((item): item is Notice & { kind: "calendar" } => item.kind === "calendar").map((item) => item.notice.messageId);
    const meetingIds = items.filter((item): item is Notice & { kind: "meeting" } => item.kind === "meeting").map((item) => item.notice.messageId);
    await Promise.all([
      calendarIds.length ? fetch("/api/v1/calendar-invitations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ messageIds: calendarIds }) }) : null,
      meetingIds.length ? fetch("/api/v1/meeting-invitations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ messageIds: meetingIds }) }) : null,
    ]);
    setPending(false);
    setOpen(false);
    refreshUnreadCount();
  }

  async function openCalendar(notice: CalendarInvitationNotice) {
    await acknowledge();
    if (!notice.calendarEventId) return;
    router.push(`/calendar?view=day&date=${dateKey(notice.invitation.startAt)}&edit=${encodeURIComponent(notice.calendarEventId)}`);
  }

  async function openMeeting() {
    await acknowledge();
    router.push("/meetrooms");
  }

  if (!items.length) return null;

  return <Dialog.Root open={open} onOpenChange={(next) => { if (!next && !pending) void acknowledge(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="calendar-modal-backdrop" />
      <Dialog.Content className="calendar-invitation-modal">
        <header>
          <div><Dialog.Title>새 초청</Dialog.Title><Dialog.Description>확인하지 않은 초청 {items.length}건입니다.</Dialog.Description></div>
          <button type="button" aria-label="초청 창 닫기" onClick={() => void acknowledge()} disabled={pending}><X aria-hidden="true" /></button>
        </header>
        <div className="calendar-invitation-list">
          {items.map((item) => item.kind === "calendar" ? <article key={item.notice.messageId}>
            <div className="calendar-invitation-icon"><CalendarIcon aria-hidden="true" /></div>
            <div>
              <strong>{item.notice.invitation.title}{item.notice.invitation.isRecurring && " · 반복"}</strong>
              <p>{periodOf(item.notice.invitation.startAt, item.notice.invitation.endAt, item.notice.invitation.allDay)}</p>
              {item.notice.invitation.location && <small><MapPin aria-hidden="true" />{item.notice.invitation.location}</small>}
              <small>초청자: {item.notice.senderName} ({item.notice.senderUserId})</small>
            </div>
            {item.notice.calendarEventId && <button className="button secondary small" type="button" onClick={() => void openCalendar(item.notice)} disabled={pending}>일정 보기</button>}
          </article> : <article key={item.notice.messageId}>
            <div className="calendar-invitation-icon"><TeamIcon aria-hidden="true" /></div>
            <div>
              <strong>{item.notice.invitation.roomName}</strong>
              <p>{periodOf(item.notice.invitation.startAt, item.notice.invitation.endAt, false)}</p>
              {item.notice.invitation.purpose && <small>{item.notice.invitation.purpose}</small>}
              <small>초청자: {item.notice.senderName} ({item.notice.senderUserId})</small>
            </div>
            <button className="button secondary small" type="button" onClick={() => void openMeeting()} disabled={pending}>예약 보기</button>
          </article>)}
        </div>
        <footer><button className="button primary" type="button" onClick={() => void acknowledge()} disabled={pending}>{pending ? "확인 중…" : "모두 확인"}</button></footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
