"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { AdminUserRow } from "@/lib/server/admin";

const ROLE_LABEL: Record<string, string> = { ADMIN: "관리자", OPERATOR: "운영자", MEMBER: "일반" };

export function UserManagementScreen({ users, q }: { users: AdminUserRow[]; q: string }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [tempPassword, setTempPassword] = useState<{ userId: string; value: string } | null>(null);

  async function changeRole(user: AdminUserRow, role: string) {
    setPending(`role-${user.id}`); setMessage("");
    const response = await fetch(`/api/v1/admin/users/${user.id}/role`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role }) });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "역할을 변경하지 못했습니다."); return; }
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
    setPending(`reset-${user.id}`); setMessage(""); setTempPassword(null);
    const response = await fetch(`/api/v1/admin/users/${user.id}/reset-password`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "비밀번호를 초기화하지 못했습니다."); return; }
    setTempPassword({ userId: user.userId, value: payload.data.tempPassword });
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("q");
    router.push(value ? `/settings/users?q=${encodeURIComponent(String(value))}` : "/settings/users");
  }

  return <>
    <header className="topbar"><div><h1>사용자 관리</h1><p>역할 변경, 계정 잠금, 비밀번호 강제 초기화를 관리합니다.</p></div></header>
    <div className="content settings-content">
      {message && <p className="form-error action-message" role="alert">{message}</p>}
      {tempPassword && <p className="form-success action-message" role="status">{tempPassword.userId} 임시 비밀번호: <strong className="mono">{tempPassword.value}</strong> (다시 표시되지 않습니다. 사용자에게 안전하게 전달하세요.)</p>}
      <section className="panel">
        <form className="inline-create" onSubmit={search}>
          <label>아이디·이름 검색<input name="q" defaultValue={q} placeholder="검색어 입력" maxLength={100} /></label>
          <button className="button secondary" type="submit">검색</button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>사용자 목록</h2><span>{users.length}명</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>아이디</th><th>이름</th><th>부서</th><th>역할</th><th>상태</th><th /></tr></thead>
            <tbody>
              {users.map((user) => <tr key={user.id}>
                <td className="mono">{user.userId}</td>
                <td>{user.name}</td>
                <td>{user.department ?? "-"}</td>
                <td>
                  <select value={user.role} disabled={pending === `role-${user.id}`} onChange={(event) => changeRole(user, event.target.value)}>
                    {Object.entries(ROLE_LABEL).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                  </select>
                </td>
                <td><span className={`badge ${user.status === "LOCKED" ? "issue" : "level-pm"}`}>{user.status === "LOCKED" ? "잠김" : "정상"}</span></td>
                <td className="topbar-actions">
                  <button className="button secondary" type="button" disabled={pending === `status-${user.id}`} onClick={() => toggleStatus(user)}>{user.status === "LOCKED" ? "잠금 해제" : "계정 잠금"}</button>
                  <button className="button secondary" type="button" disabled={pending === `reset-${user.id}`} onClick={() => resetPassword(user)}>비밀번호 초기화</button>
                </td>
              </tr>)}
              {!users.length && <tr><td colSpan={6} className="empty">검색 결과가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </>;
}
