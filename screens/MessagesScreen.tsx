"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { MessageSummary } from "@/lib/server/messages";
import type { ProjectMemberOption } from "@/lib/server/users";
import { useUnreadMessageCount } from "@/components/UnreadMessageProvider";

function MessageRow({ message }: { message: MessageSummary }) {
  const { refresh: refreshUnreadCount } = useUnreadMessageCount();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function view(event: FormEvent) {
    event.preventDefault();
    setPending(true); setError("");
    const response = await fetch(`/api/v1/messages/${message.id}/view`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) { setError(payload?.error?.message ?? "조회에 실패했습니다."); return; }
    setContent(payload.data.content);
    if (message.direction === "received" && !message.isRead) refreshUnreadCount();
  }

  return <div className={`message-row ${message.isRead ? "" : "unread"}`}>
    <div className="message-row-head" onClick={() => setOpen((o) => !o)}>
      <span>{message.direction === "received" ? "보낸 사람" : "받는 사람"}: {message.counterpartName} ({message.counterpartUserId})</span>
      <span className="mono">{new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(message.createdAt))}</span>
      {!message.isRead && message.direction === "received" && <span className="badge issue">미확인</span>}
    </div>
    {open && <div className="message-row-body">
      {content === null ? <form onSubmit={view} className="inline-create">
        <label>조회 비밀번호<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button className="button primary" type="submit" disabled={pending}>{pending ? "확인 중…" : "열람"}</button>
        {error && <p className="form-error">{error}</p>}
      </form> : <p className="message-content">{content}</p>}
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
    const response = await fetch("/api/v1/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ receiverUserId: data.get("receiverUserId"), content: data.get("content"), viewPassword: data.get("viewPassword") }) });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) { setMessage(payload?.error?.message ?? "쪽지를 보내지 못했습니다."); return; }
    form.reset(); setMessage("쪽지를 보냈습니다."); router.refresh();
  }

  return <form className="calendar-event-form" onSubmit={submit}>
    <label>받는 사람 아이디<input name="receiverUserId" list="member-options" required maxLength={50} /></label>
    <datalist id="member-options">{members.map((m) => <option value={m.userId} key={m.id}>{m.name}</option>)}</datalist>
    <label>내용<textarea name="content" rows={4} required maxLength={5000} /></label>
    <label>조회 비밀번호 (수신자가 열람 시 입력)<input name="viewPassword" type="password" required minLength={4} maxLength={100} /></label>
    {message && <p className={message === "쪽지를 보냈습니다." ? "form-success" : "form-error"}>{message}</p>}
    <button className="button primary" disabled={pending}>{pending ? "전송 중…" : "쪽지 보내기"}</button>
  </form>;
}

export function MessagesScreen({ messages, members, box }: { messages: MessageSummary[]; members: ProjectMemberOption[]; box: "received" | "sent" }) {
  return <>
    <header className="topbar"><div><h1>쪽지</h1><p>쪽지 내용은 암호화되어 저장되며, 조회 비밀번호를 입력해야 볼 수 있습니다.</p></div></header>
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
