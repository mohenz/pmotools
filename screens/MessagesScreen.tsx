"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { InvitationSummary } from "@/lib/server/messages";
import { useUnreadMessageCount } from "@/components/UnreadMessageProvider";

function invitationDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function invitationPeriod(startAt: string, endAt: string, allDay: boolean) {
  const date = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" }).format(new Date(startAt));
  if (allDay) return `${date} · 종일`;
  const time = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Seoul" });
  return `${date} ${time.format(new Date(startAt))}–${time.format(new Date(endAt))}`;
}

function InvitationRow({ invitation }: { invitation: InvitationSummary }) {
  const { refresh: refreshUnreadCount } = useUnreadMessageCount();
  const [error, setError] = useState("");
  const [read, setRead] = useState(invitation.isRead);

  useEffect(() => {
    if (read) return;
    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/v1/messages/${invitation.id}/view`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (cancelled) return;
      if (!response.ok) { const payload = await response.json().catch(() => null); setError(payload?.error?.message ?? "초청을 확인하지 못했습니다."); return; }
      setRead(true); refreshUnreadCount();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitation.id]);

  return <div className={`message-row ${read ? "" : "unread"}`}>
    <div className="message-row-head">
      <span className="message-row-sender"><b>{invitation.messageType === "CALENDAR_INVITATION" ? "일정 초청" : "회의실 예약 초청"} · </b>보낸 사람: {invitation.senderName} ({invitation.senderUserId})</span>
      {invitation.messageType === "CALENDAR_INVITATION" && invitation.calendarInvitation && <span className="message-row-schedule">
        <strong>{invitation.calendarInvitation.title}{invitation.calendarInvitation.isRecurring && " · 반복 일정"}</strong>
        <span>{invitationPeriod(invitation.calendarInvitation.startAt, invitation.calendarInvitation.endAt, invitation.calendarInvitation.allDay)}</span>
      </span>}
      <span className="message-row-meta">
        <span className="mono">{new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(invitation.createdAt))}</span>
        {!read && <span className="badge issue">미확인</span>}
      </span>
    </div>
    <div className="message-row-body">
      {invitation.messageType === "CALENDAR_INVITATION" && invitation.calendarInvitation ? <div className="message-invitation-detail">
        {invitation.calendarInvitation.location && <p>장소: {invitation.calendarInvitation.location}</p>}
        {invitation.calendarInvitation.description && <p>{invitation.calendarInvitation.description}</p>}
        {invitation.calendarEventId && <Link className="button secondary small" href={`/calendar?view=day&date=${invitationDateKey(invitation.calendarInvitation.startAt)}&edit=${encodeURIComponent(invitation.calendarEventId)}`}>일정 보기</Link>}
        {error && <p className="form-error">{error}</p>}
      </div> : invitation.messageType === "MEETING_INVITATION" && invitation.meetingInvitation ? <div className="message-invitation-detail">
        <strong>{invitation.meetingInvitation.roomName}</strong>
        <p>{invitationPeriod(invitation.meetingInvitation.startAt, invitation.meetingInvitation.endAt, false)}</p>
        <p>주최자: {invitation.meetingInvitation.organizerName}</p>
        {invitation.meetingInvitation.purpose && <p>{invitation.meetingInvitation.purpose}</p>}
        <Link className="button secondary small" href="/meetrooms">예약 보기</Link>
        {error && <p className="form-error">{error}</p>}
      </div> : null}
    </div>
  </div>;
}

export function MessagesScreen({ invitations }: { invitations: InvitationSummary[] }) {
  return <>
    <header className="topbar"><div><h1>초청</h1><p>받은 일정·회의실 예약 초청 목록입니다.</p></div></header>
    <div className="content">
      <section className="panel">
        <div className="panel-head"><h2>받은 초청</h2><span>{invitations.length}건</span></div>
        <div className="message-list">
          {invitations.map((invitation) => <InvitationRow invitation={invitation} key={invitation.id} />)}
          {!invitations.length && <p className="empty">받은 초청이 없습니다.</p>}
        </div>
      </section>
    </div>
  </>;
}
