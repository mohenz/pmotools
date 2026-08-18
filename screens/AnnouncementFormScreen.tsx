"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AnnouncementDetail } from "@/lib/server/announcements";

function inputDate(value: string | null | undefined) { if (!value) return ""; return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(value)); }

export function AnnouncementFormScreen({ announcement }: { announcement?: AnnouncementDetail }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showOnDashboard, setShowOnDashboard] = useState(announcement?.showOnDashboard ?? false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(announcement ? `/api/v1/announcements/${announcement.id}` : "/api/v1/announcements", { method: announcement ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      title: form.get("title"), content: form.get("content"), audience: form.get("audience"), isImportant: form.get("isImportant") === "on", showOnDashboard: form.get("showOnDashboard") === "on", dashboardVisibleTo: form.get("dashboardVisibleTo") || null, publishedAt: form.get("publishedAt") || undefined, expiresAt: form.get("expiresAt") || null,
    }) });
    if (!response.ok) { const body = await response.json().catch(() => null); setError(body?.error?.message ?? "저장하지 못했습니다."); setSaving(false); return; }
    const body = await response.json(); router.push(`/announcements/${body.data.id}`); router.refresh();
  }
  return <>
    <header className="topbar"><div><h1>{announcement ? "공지사항 수정" : "공지사항 등록"}</h1><p>프로젝트 구성원에게 전달할 안내를 작성합니다.</p></div></header>
    <div className="content announcement-content"><section className="panel form-panel announcement-form"><form onSubmit={submit}>
      <label>제목<input name="title" required maxLength={200} defaultValue={announcement?.title ?? ""} placeholder="공지 제목을 입력하세요" /></label>
      <label>내용<textarea name="content" required maxLength={30000} rows={14} defaultValue={announcement?.content ?? ""} placeholder="공지 내용을 입력하세요" /></label>
      <div className="form-grid"><label>공지 대상<select name="audience" defaultValue={announcement?.audience ?? "ALL"}><option value="ALL">전체 사용자</option><option value="MANAGERS">관리자·운영자</option></select></label><label>게시 시작일<input type="date" name="publishedAt" defaultValue={inputDate(announcement?.publishedAt)} /></label></div>
      <div className="form-grid"><label>게시 종료일<input type="date" name="expiresAt" defaultValue={inputDate(announcement?.expiresAt)} /></label><label>메인 노출 종료일<input type="date" name="dashboardVisibleTo" disabled={!showOnDashboard} defaultValue={inputDate(announcement?.dashboardVisibleTo)} /></label></div>
      <div className="announcement-options"><label><input type="checkbox" name="isImportant" defaultChecked={announcement?.isImportant} /> 중요 공지로 상단 고정</label><label><input type="checkbox" name="showOnDashboard" checked={showOnDashboard} onChange={(event) => setShowOnDashboard(event.target.checked)} /> 메인 화면 노출</label></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><Link className="button secondary" href={announcement ? `/announcements/${announcement.id}` : "/announcements"}>취소</Link><button className="button primary" disabled={saving}>{saving ? "저장 중…" : "저장"}</button></div>
    </form></section></div>
  </>;
}
