"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { MyProfile } from "@/lib/server/users";

const ROLE_LABEL: Record<string, string> = { ADMIN: "관리자", OPERATOR: "운영자", MEMBER: "일반" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(value));
}

export function MyProfileScreen({ profile }: { profile: MyProfile }) {
  const router = useRouter();
  const [current, setCurrent] = useState(profile);
  const [form, setForm] = useState({ name: profile.name, email: profile.email ?? "", department: profile.department ?? "", jobTitle: profile.jobTitle ?? "" });
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", newPasswordConfirm: "" });
  const [profilePending, setProfilePending] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwPending, setPwPending] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfilePending(true); setProfileMessage(null);
    const response = await fetch("/api/v1/me/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const payload = await response.json().catch(() => null);
    setProfilePending(false);
    if (!response.ok) { setProfileMessage({ type: "error", text: payload?.error?.message ?? "정보를 저장하지 못했습니다." }); return; }
    setCurrent((prev) => ({ ...prev, name: payload.data.name, email: payload.data.email, department: payload.data.department, jobTitle: payload.data.jobTitle }));
    setProfileMessage({ type: "success", text: "정보가 저장되었습니다." });
    router.refresh();
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPwMessage(null);
    if (pwForm.newPassword !== pwForm.newPasswordConfirm) { setPwMessage({ type: "error", text: "새 비밀번호 확인이 일치하지 않습니다." }); return; }
    setPwPending(true);
    const response = await fetch("/api/v1/me/password", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }) });
    const payload = await response.json().catch(() => null);
    setPwPending(false);
    if (!response.ok) { setPwMessage({ type: "error", text: payload?.error?.message ?? "비밀번호를 변경하지 못했습니다." }); return; }
    setPwForm({ currentPassword: "", newPassword: "", newPasswordConfirm: "" });
    setPwMessage({ type: "success", text: "비밀번호가 변경되었습니다." });
  }

  return <>
    <header className="topbar"><div><h1>내 정보</h1><p>내 계정 정보를 확인하고 수정합니다.</p></div></header>
    <div className="content settings-content">
      <section className="panel detail-summary" style={{ maxWidth: 640 }}>
        <dl>
          <div><dt>아이디</dt><dd className="mono">{current.userId}</dd></div>
          <div><dt>권한</dt><dd><span className="badge">{ROLE_LABEL[current.role] ?? current.role}</span></dd></div>
          <div><dt>계정 상태</dt><dd><span className={`badge ${current.status === "LOCKED" ? "issue" : "level-pm"}`}>{current.status === "LOCKED" ? "잠김" : "정상"}</span></dd></div>
          <div><dt>가입일</dt><dd>{formatDate(current.createdAt)}</dd></div>
        </dl>
      </section>

      <section className="panel form-panel" style={{ maxWidth: 640 }}>
        <div className="panel-head"><h2>정보 수정</h2></div>
        <form onSubmit={saveProfile}>
          <label>이름<input value={form.name} onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))} required maxLength={50} /></label>
          <label>이메일<input type="email" value={form.email} onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))} maxLength={100} /></label>
          <label>회사명<input value={form.department} onChange={(event) => setForm((f) => ({ ...f, department: event.target.value }))} maxLength={100} /></label>
          <label>직책<input value={form.jobTitle} onChange={(event) => setForm((f) => ({ ...f, jobTitle: event.target.value }))} maxLength={100} /></label>
          {profileMessage && <p className={profileMessage.type === "error" ? "form-error" : "form-success"} role={profileMessage.type === "error" ? "alert" : "status"}>{profileMessage.text}</p>}
          <button className="button primary" type="submit" disabled={profilePending}>{profilePending ? "저장 중…" : "저장"}</button>
        </form>
      </section>

      <section className="panel form-panel" style={{ maxWidth: 640 }}>
        <div className="panel-head"><h2>비밀번호 변경</h2></div>
        <form onSubmit={changePassword}>
          <label>현재 비밀번호<input type="password" autoComplete="current-password" value={pwForm.currentPassword} onChange={(event) => setPwForm((f) => ({ ...f, currentPassword: event.target.value }))} required /></label>
          <label>새 비밀번호<input type="password" autoComplete="new-password" value={pwForm.newPassword} onChange={(event) => setPwForm((f) => ({ ...f, newPassword: event.target.value }))} required minLength={8} maxLength={100} /></label>
          <label>새 비밀번호 확인<input type="password" autoComplete="new-password" value={pwForm.newPasswordConfirm} onChange={(event) => setPwForm((f) => ({ ...f, newPasswordConfirm: event.target.value }))} required minLength={8} maxLength={100} /></label>
          {pwMessage && <p className={pwMessage.type === "error" ? "form-error" : "form-success"} role={pwMessage.type === "error" ? "alert" : "status"}>{pwMessage.text}</p>}
          <button className="button primary" type="submit" disabled={pwPending}>{pwPending ? "변경 중…" : "비밀번호 변경"}</button>
        </form>
      </section>
    </div>
  </>;
}
