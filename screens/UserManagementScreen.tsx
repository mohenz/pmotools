"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { AdminUserRow } from "@/lib/server/admin";
import type { PasswordResetRequestRow } from "@/lib/server/password-reset-requests";

const ROLE_LABEL: Record<string, string> = { ADMIN: "관리자", OPERATOR: "운영자", MEMBER: "일반" };

type ProfileDraft = { name: string; email: string; department: string; jobTitle: string };
const emptyCreateDraft = { userId: "", name: "", email: "", department: "", jobTitle: "", role: "MEMBER" };

export function UserManagementScreen({ users, q, resetRequests }: { users: AdminUserRow[]; q: string; resetRequests: PasswordResetRequestRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [tempPassword, setTempPassword] = useState<{ userId: string; value: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ProfileDraft>>({});
  const [createDraft, setCreateDraft] = useState(emptyCreateDraft);
  const [resetDrafts, setResetDrafts] = useState<Record<string, string>>({});

  async function resolveRequest(requestId: string) {
    setPending(`resolve-${requestId}`); setMessage("");
    const response = await fetch(`/api/v1/admin/password-reset-requests/${requestId}/resolve`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "요청을 처리하지 못했습니다."); return; }
    router.refresh();
  }

  function draftFor(user: AdminUserRow): ProfileDraft {
    return drafts[user.id] ?? { name: user.name, email: user.email ?? "", department: user.department ?? "", jobTitle: user.jobTitle ?? "" };
  }
  function updateDraft(user: AdminUserRow, field: keyof ProfileDraft, value: string) {
    setDrafts((prev) => ({ ...prev, [user.id]: { ...draftFor(user), [field]: value } }));
  }

  async function changeRole(user: AdminUserRow, role: string) {
    setPending(`role-${user.id}`); setMessage("");
    const response = await fetch(`/api/v1/admin/users/${user.id}/role`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role }) });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "권한을 변경하지 못했습니다."); return; }
    router.refresh();
  }
  async function toggleStatus(user: AdminUserRow) {
    const next = user.status === "ACTIVE" ? "LOCKED" : "ACTIVE";
    setPending(`status-${user.id}`); setMessage("");
    const response = await fetch(`/api/v1/admin/users/${user.id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "계정 상태를 변경하지 못했습니다."); return; }
    router.refresh();
  }
  async function resetPassword(user: AdminUserRow) {
    const manual = (resetDrafts[user.id] ?? "").trim();
    if (manual && manual.length < 8) { setMessage("직접 지정하는 비밀번호는 8자 이상이어야 합니다."); return; }
    setPending(`reset-${user.id}`); setMessage(""); setTempPassword(null);
    const response = await fetch(`/api/v1/admin/users/${user.id}/reset-password`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: manual || undefined }) });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "비밀번호를 초기화하지 못했습니다."); return; }
    setResetDrafts((prev) => { const next = { ...prev }; delete next[user.id]; return next; });
    setTempPassword({ userId: user.userId, value: payload.data.tempPassword });
  }
  async function saveProfile(user: AdminUserRow) {
    const draft = draftFor(user);
    setPending(`profile-${user.id}`); setMessage("");
    const response = await fetch(`/api/v1/admin/users/${user.id}/profile`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "정보를 저장하지 못했습니다."); return; }
    setDrafts((prev) => { const next = { ...prev }; delete next[user.id]; return next; });
    router.refresh();
  }
  async function deleteAccount(user: AdminUserRow) {
    setPending(`delete-${user.id}`); setMessage(""); setTempPassword(null);
    const response = await fetch(`/api/v1/admin/users/${user.id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "계정을 삭제하지 못했습니다."); return; }
    setDrafts((prev) => { const next = { ...prev }; delete next[user.id]; return next; });
    setResetDrafts((prev) => { const next = { ...prev }; delete next[user.id]; return next; });
    router.refresh();
  }
  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("create"); setMessage(""); setTempPassword(null);
    const response = await fetch("/api/v1/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(createDraft) });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "사용자를 등록하지 못했습니다."); return; }
    setTempPassword({ userId: payload.data.userId, value: payload.data.tempPassword });
    setCreateDraft(emptyCreateDraft);
    router.refresh();
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("q");
    router.push(value ? `/settings/users?q=${encodeURIComponent(String(value))}` : "/settings/users");
  }

  return <>
    <header className="topbar"><div><h1>사용자 관리</h1><p>사용자 등록, 정보 수정, 권한 변경, 계정 잠금, 비밀번호 강제 초기화를 관리합니다.</p></div></header>
    <div className="content settings-content">
      {message && <p className="form-error action-message" role="alert">{message}</p>}
      {tempPassword && <p className="form-success action-message" role="status">{tempPassword.userId} 임시 비밀번호: <strong className="mono">{tempPassword.value}</strong> (다시 표시되지 않습니다. 사용자에게 안전하게 전달하세요.)</p>}
      {resetRequests.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>비밀번호 초기화 요청</h2><span>{resetRequests.length}건</span></div>
          <div className="table-wrap">
            <table className="dense-table">
              <thead><tr><th>아이디</th><th>이름</th><th>메모</th><th>요청 일시</th><th /></tr></thead>
              <tbody>
                {resetRequests.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.userId}</td>
                    <td>{r.name}</td>
                    <td>{r.note || "—"}</td>
                    <td className="mono">{new Date(r.createdAt).toLocaleString("ko-KR")}</td>
                    <td className="topbar-actions">
                      <button className="button secondary" type="button" disabled={pending === `resolve-${r.id}`} onClick={() => resolveRequest(r.id)}>{pending === `resolve-${r.id}` ? "처리 중…" : "처리 완료"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="panel">
        <form className="inline-create" onSubmit={search}>
          <label>아이디·이름 검색<input name="q" defaultValue={q} placeholder="검색어 입력" maxLength={100} /></label>
          <button className="button secondary" type="submit">검색</button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>사용자 등록</h2></div>
        <form className="inline-create user-create" onSubmit={createUser}>
          <label>아이디<input value={createDraft.userId} onChange={(event) => setCreateDraft((d) => ({ ...d, userId: event.target.value }))} placeholder="영문/숫자/._-" required minLength={3} maxLength={50} /></label>
          <label>이름<input value={createDraft.name} onChange={(event) => setCreateDraft((d) => ({ ...d, name: event.target.value }))} required maxLength={50} /></label>
          <label>이메일<input type="email" value={createDraft.email} onChange={(event) => setCreateDraft((d) => ({ ...d, email: event.target.value }))} maxLength={100} /></label>
          <label>회사명<input value={createDraft.department} onChange={(event) => setCreateDraft((d) => ({ ...d, department: event.target.value }))} maxLength={100} /></label>
          <label>직책<input value={createDraft.jobTitle} onChange={(event) => setCreateDraft((d) => ({ ...d, jobTitle: event.target.value }))} maxLength={100} /></label>
          <label>권한
            <select value={createDraft.role} onChange={(event) => setCreateDraft((d) => ({ ...d, role: event.target.value }))}>
              {Object.entries(ROLE_LABEL).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          <button className="button primary" type="submit" disabled={pending === "create"}>{pending === "create" ? "등록 중…" : "+ 사용자 등록"}</button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>사용자 목록</h2><span>{users.length}명</span></div>
        <div className="table-wrap">
          <table className="dense-table">
            <thead><tr><th>아이디</th><th>이름</th><th>이메일</th><th>회사명</th><th>직책</th><th>권한</th><th>상태</th><th /></tr></thead>
            <tbody>
              {users.map((user) => {
                const draft = draftFor(user);
                return <tr key={user.id}>
                  <td className="mono">{user.userId}</td>
                  <td><input aria-label={`${user.userId} 이름`} value={draft.name} onChange={(event) => updateDraft(user, "name", event.target.value)} required maxLength={50} /></td>
                  <td><input aria-label={`${user.userId} 이메일`} type="email" value={draft.email} onChange={(event) => updateDraft(user, "email", event.target.value)} maxLength={100} /></td>
                  <td><input aria-label={`${user.userId} 회사명`} value={draft.department} onChange={(event) => updateDraft(user, "department", event.target.value)} maxLength={100} /></td>
                  <td><input aria-label={`${user.userId} 직책`} value={draft.jobTitle} onChange={(event) => updateDraft(user, "jobTitle", event.target.value)} maxLength={100} /></td>
                  <td>
                    <select className="user-role-select" aria-label={`${user.userId} 권한`} value={user.role} disabled={pending === `role-${user.id}`} onChange={(event) => changeRole(user, event.target.value)}>
                      {Object.entries(ROLE_LABEL).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                    </select>
                  </td>
                  <td><span className={`badge ${user.status === "LOCKED" ? "issue" : "level-pm"}`}>{user.status === "LOCKED" ? "잠김" : "정상"}</span></td>
                  <td className="topbar-actions">
                    <button className="button secondary" type="button" disabled={pending === `profile-${user.id}`} onClick={() => saveProfile(user)}>{pending === `profile-${user.id}` ? "저장 중…" : "정보 저장"}</button>
                    <button className="button secondary" type="button" disabled={pending === `status-${user.id}`} onClick={() => toggleStatus(user)}>{user.status === "LOCKED" ? "잠금 해제" : "계정 잠금"}</button>
                    <span className="inline-action-group">
                      <input aria-label={`${user.userId} 지정 비밀번호(선택)`} className="mono" style={{ width: 140 }} placeholder="비밀번호 입력" value={resetDrafts[user.id] ?? ""} onChange={(event) => setResetDrafts((prev) => ({ ...prev, [user.id]: event.target.value }))} minLength={8} maxLength={100} />
                      <button className="button secondary" type="button" disabled={pending === `reset-${user.id}`} onClick={() => resetPassword(user)}>{resetDrafts[user.id]?.trim() ? "비밀번호 지정" : "비밀번호 초기화"}</button>
                    </span>
                    <AlertDialog.Root>
                      <AlertDialog.Trigger asChild><button className="button danger" type="button" disabled={pending === `delete-${user.id}`}>{pending === `delete-${user.id}` ? "삭제 중…" : "계정 삭제"}</button></AlertDialog.Trigger>
                      <AlertDialog.Portal>
                        <AlertDialog.Overlay className="calendar-modal-backdrop" />
                        <AlertDialog.Content className="alert-dialog">
                          <AlertDialog.Title asChild><h2>{user.userId} 계정을 삭제하시겠습니까?</h2></AlertDialog.Title>
                          <AlertDialog.Description asChild><p>로그인과 프로젝트 접근이 즉시 차단됩니다. 작성된 업무 및 감사 이력은 보존됩니다.</p></AlertDialog.Description>
                          <div className="alert-dialog-actions">
                            <AlertDialog.Cancel asChild><button className="button secondary" type="button">취소</button></AlertDialog.Cancel>
                            <AlertDialog.Action asChild><button className="button danger" type="button" onClick={() => deleteAccount(user)}>계정 삭제</button></AlertDialog.Action>
                          </div>
                        </AlertDialog.Content>
                      </AlertDialog.Portal>
                    </AlertDialog.Root>
                  </td>
                </tr>;
              })}
              {!users.length && <tr><td colSpan={8} className="empty">검색 결과가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </>;
}
