"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { GroupRow } from "@/lib/server/admin";

export function GroupManagementScreen({ groups, groupType }: { groups: GroupRow[]; groupType: "WORK_MODULE" | "COMPANY" }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form);
    setPending("create"); setMessage("");
    const response = await fetch("/api/v1/admin/groups", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ groupType, code: data.get("code"), label: data.get("label"), color: data.get("color") || null, sortOrder: Number(data.get("sortOrder")) }) });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "그룹을 추가하지 못했습니다."); return; }
    form.reset(); router.refresh();
  }
  async function updateGroup(event: FormEvent<HTMLFormElement>, group: GroupRow) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(group.id); setMessage("");
    const response = await fetch(`/api/v1/admin/groups/${group.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: data.get("label"), color: data.get("color") || null, sortOrder: Number(data.get("sortOrder")), isActive: data.get("isActive") === "on" }) });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "그룹을 저장하지 못했습니다."); return; }
    router.refresh();
  }

  return <>
    <header className="topbar"><div><h1>그룹 관리</h1><p>업무모듈(Track)과 조직 그룹을 관리합니다.</p></div></header>
    <div className="content settings-content">
      {message && <p className="form-error action-message" role="alert">{message}</p>}
      <section className="panel compact">
        <nav className="tool-tabs" aria-label="그룹 구분">
          <Link className={groupType === "WORK_MODULE" ? "active" : ""} href="/settings/groups?type=WORK_MODULE">업무모듈</Link>
          <Link className={groupType === "COMPANY" ? "active" : ""} href="/settings/groups?type=COMPANY">조직 그룹</Link>
        </nav>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>{groupType === "WORK_MODULE" ? "업무모듈" : "조직 그룹"} 목록</h2><span>{groups.length}개</span></div>
        <div className={`code-row code-row-head`} aria-hidden="true"><span>코드</span><span>명칭</span><span>색상</span><span>순서</span><span>활성</span><span /></div>
        <div className="code-list">
          {groups.map((group) => <form className={`code-row ${group.isActive ? "" : "inactive"}`} onSubmit={(event) => updateGroup(event, group)} key={group.id}>
            <span className="mono code-value">{group.code}</span>
            <input name="label" aria-label={`${group.code} 명칭`} defaultValue={group.label} required maxLength={100} />
            <input name="color" aria-label={`${group.code} 색상`} type="color" defaultValue={group.color ?? "#3358E0"} />
            <input name="sortOrder" aria-label={`${group.code} 순서`} type="number" min="0" max="9999" defaultValue={group.sortOrder} required />
            <label className="toggle"><input name="isActive" type="checkbox" defaultChecked={group.isActive} /> 활성</label>
            <button className="button secondary" type="submit" disabled={!!pending}>{pending === group.id ? "저장 중…" : "저장"}</button>
          </form>)}
          {!groups.length && <p className="empty">등록된 그룹이 없습니다.</p>}
        </div>
        <form className="code-row code-create" onSubmit={createGroup}>
          <input name="code" aria-label="신규 그룹 코드" placeholder="코드 (예: TRACK_E)" pattern="[A-Za-z][A-Za-z0-9_-]*" required maxLength={50} />
          <input name="label" aria-label="신규 그룹 명칭" placeholder="표시 명칭" required maxLength={100} />
          <input name="color" aria-label="신규 그룹 색상" type="color" defaultValue="#3358E0" />
          <input name="sortOrder" aria-label="신규 그룹 순서" type="number" min="0" max="9999" defaultValue="99" required />
          <span />
          <button className="button primary" type="submit" disabled={!!pending}>{pending === "create" ? "추가 중…" : "+ 그룹 추가"}</button>
        </form>
      </section>
    </div>
  </>;
}
