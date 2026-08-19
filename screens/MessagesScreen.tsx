"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { MessageSummary } from "@/lib/server/messages";
import type { ProjectMemberOption } from "@/lib/server/users";
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

function MessageRow({ message }: { message: MessageSummary }) {
  const { refresh: refreshUnreadCount } = useUnreadMessageCount();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [read, setRead] = useState(message.isRead);

  async function loadContent() {
    setPending(true); setError("");
    const response = await fetch(`/api/v1/messages/${message.id}/view`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) { setError(payload?.error?.message ?? "조회에 실패했습니다."); return; }
    setContent(payload.data.content);
    if (message.direction === "received" && !read) { setRead(true); refreshUnreadCount(); }
  }

  async function markInvitationRead() {
    setPending(true); setError("");
    const response = await fetch(`/api/v1/messages/${message.id}/view`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    setPending(false);
    if (!response.ok) { const payload = await response.json().catch(() => null); setError(payload?.error?.message ?? "일정 초청을 확인하지 못했습니다."); return; }
    setRead(true); refreshUnreadCount();
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && message.messageType === "CALENDAR_INVITATION" && message.direction === "received" && !read) void markInvitationRead();
    if (next && message.messageType === "DIRECT" && !message.isLegacyPasswordProtected && content === null && !pending) void loadContent();
  }

  return <div className={`message-row ${read ? "" : "unread"}`}>
    <div className="message-row-head" onClick={toggle}>
      <span>{message.messageType === "CALENDAR_INVITATION" && <b>일정 초청 · </b>}{message.direction === "received" ? "보낸 사람" : "받는 사람"}: {message.counterpartName} ({message.counterpartUserId})</span>
      <span className="mono">{new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(message.createdAt))}</span>
      {!read && message.direction === "received" && <span className="badge issue">미확인</span>}
    </div>
    {open && <div className="message-row-body">
      {message.messageType === "CALENDAR_INVITATION" && message.calendarInvitation ? <div className="message-invitation-detail">
        <strong>{message.calendarInvitation.title}{message.calendarInvitation.isRecurring && " · 반복 일정"}</strong>
        <p>{invitationPeriod(message.calendarInvitation.startAt, message.calendarInvitation.endAt, message.calendarInvitation.allDay)}</p>
        {message.calendarInvitation.location && <p>장소: {message.calendarInvitation.location}</p>}
        {message.calendarInvitation.description && <p>{message.calendarInvitation.description}</p>}
        {message.calendarEventId && <Link className="button secondary small" href={`/calendar?view=day&date=${invitationDateKey(message.calendarInvitation.startAt)}&edit=${encodeURIComponent(message.calendarEventId)}`}>일정 보기</Link>}
        {error && <p className="form-error">{error}</p>}
      </div> : message.isLegacyPasswordProtected ? <p className="form-error">기존 비밀번호 보호 쪽지는 자동 열람을 지원하지 않습니다.</p>
        : pending ? <p className="empty">쪽지를 불러오는 중…</p>
          : error ? <p className="form-error">{error}</p>
            : content !== null ? <p className="message-content">{content}</p>
              : null}
    </div>}
  </div>;
}

function ComposeForm({ members }: { members: ProjectMemberOption[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form);
    setPending(true); setMessage("");
    const response = await fetch("/api/v1/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ receiverUserId: data.get("receiverUserId"), content: data.get("content") }) });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) { setMessage(payload?.error?.message ?? "쪽지를 보내지 못했습니다."); return; }
    form.reset(); setMessage("쪽지를 보냈습니다."); router.refresh();
  }

  return <form className="calendar-event-form" onSubmit={submit}>
    <label>받는 사람 아이디<input name="receiverUserId" list="member-options" required maxLength={50} /></label>
    <datalist id="member-options">{members.map((m) => <option value={m.userId} key={m.id}>{m.name}</option>)}</datalist>
    <label>내용<textarea name="content" rows={4} required maxLength={5000} /></label>
    {message && <p className={message === "쪽지를 보냈습니다." ? "form-success" : "form-error"}>{message}</p>}
    <button className="button primary" disabled={pending}>{pending ? "전송 중…" : "쪽지 보내기"}</button>
  </form>;
}

export function MessagesScreen({ messages, members, box }: { messages: MessageSummary[]; members: ProjectMemberOption[]; box: "received" | "sent" }) {
  return <>
    <header className="topbar"><div><h1>쪽지</h1><p>쪽지를 선택하면 내용을 바로 확인할 수 있습니다.</p></div></header>
    <div className="content">
      <section className="panel">
        <div className="panel-head"><h2>새 쪽지</h2></div>
        <ComposeForm members={members} />
      </section>
      <section className="panel">
        <div className="panel-head">
          <nav className="tool-tabs" aria-label="쪽지함 구분">
            <Link className={box === "received" ? "active" : ""} href="/messages?box=received">수신함</Link>
            <Link className={box === "sent" ? "active" : ""} href="/messages?box=sent">발신함</Link>
          </nav>
          <span>{messages.length}건</span>
        </div>
        <div className="message-list">
          {messages.map((m) => <MessageRow message={m} key={m.id} />)}
          {!messages.length && <p className="empty">쪽지가 없습니다.</p>}
        </div>
      </section>
    </div>
  </>;
}
