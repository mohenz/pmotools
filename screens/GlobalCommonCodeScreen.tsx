"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { CommonCode, CommonCodeGroup } from "@/lib/server/common-codes";
import { WarningDialog } from "@/components/WarningDialog";

type Props = { groups: CommonCodeGroup[]; selectedGroup: CommonCodeGroup | null; codes: CommonCode[] };

export function GlobalCommonCodeScreen({ groups, selectedGroup, codes }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState("");

  async function request(path: string, method: "POST" | "PATCH", body: unknown, key: string) {
    setPending(key); setMessage("");
    const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) { setMessage(payload?.error?.message ?? "설정을 저장하지 못했습니다."); setPending(""); return null; }
    setPending(""); router.refresh(); return payload?.data ?? true;
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const created = await request("/api/v1/admin/common-code-groups", "POST", {
      code: data.get("code"), label: data.get("label"), description: data.get("description"), sortOrder: Number(data.get("sortOrder")),
    }, "create-group");
    if (created?.id) { form.reset(); router.push(`/settings/global-common-codes?group=${created.id}`); }
  }

  async function updateGroup(event: FormEvent<HTMLFormElement>) {
    if (!selectedGroup) return;
    event.preventDefault(); const data = new FormData(event.currentTarget);
    await request(`/api/v1/admin/common-code-groups/${selectedGroup.id}`, "PATCH", {
      label: data.get("label"), description: data.get("description"), sortOrder: Number(data.get("sortOrder")),
      isActive: selectedGroup.isSystem || data.get("isActive") === "on",
    }, "update-group");
  }

  async function createCode(event: FormEvent<HTMLFormElement>) {
    if (!selectedGroup) return;
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const success = await request("/api/v1/admin/common-codes", "POST", {
      groupId: selectedGroup.id, code: data.get("code"), label: data.get("label"), sortOrder: Number(data.get("sortOrder")),
    }, "create-code");
    if (success) form.reset();
  }

  async function updateCode(event: FormEvent<HTMLFormElement>, code: CommonCode) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    await request(`/api/v1/admin/common-codes/${code.id}`, "PATCH", {
      label: data.get("label"), sortOrder: Number(data.get("sortOrder")), isActive: data.get("isActive") === "on",
    }, code.id);
  }

  return <>
    <header className="topbar"><div><h1>플랫폼 공통코드 설정</h1><p>업무그룹·직무·회사정보 등 프로젝트 구분 없이 플랫폼 전체에서 공유되는 코드를 관리합니다.</p></div></header>
    <div className="content settings-content">
      <WarningDialog message={message} onClose={() => setMessage("")} />
      <div className="group-settings-layout">
        <aside className="panel group-list-panel">
          <div className="panel-head"><h2>코드 그룹</h2><span>{groups.length}개</span></div>
          <nav className="group-list" aria-label="코드 그룹 목록">
            {groups.map((group) => <Link className={`group-list-item ${group.id === selectedGroup?.id ? "active" : ""} ${group.isActive ? "" : "inactive"}`} href={`/settings/global-common-codes?group=${group.id}`} key={group.id}>
              <span><strong>{group.label}</strong><small className="mono">{group.code}</small></span>
              <em>{group.activeCodeCount}/{group.codeCount}</em>
            </Link>)}
            {!groups.length && <p className="empty">등록된 전역 코드 그룹이 없습니다.</p>}
          </nav>
          <form className="panel-foot-form" onSubmit={createGroup}>
            <input name="code" placeholder="그룹 코드 (예: company)" required maxLength={50} />
            <input name="label" placeholder="그룹명 (예: 회사정보)" required maxLength={100} />
            <input name="description" placeholder="설명 (선택)" maxLength={300} />
            <input name="sortOrder" type="number" min="0" max="9999" defaultValue={groups.length} required />
            <button className="button primary" type="submit" disabled={pending === "create-group"}>{pending === "create-group" ? "생성 중…" : "그룹 추가"}</button>
          </form>
        </aside>
        <section className="panel">
          {selectedGroup ? <>
            <form className="panel-head-form" onSubmit={updateGroup}>
              <div className="panel-head"><h2>{selectedGroup.label}</h2><span className="mono">{selectedGroup.code}</span></div>
              <input name="label" defaultValue={selectedGroup.label} required maxLength={100} />
              <input name="description" defaultValue={selectedGroup.description ?? ""} maxLength={300} placeholder="설명" />
              <input name="sortOrder" type="number" min="0" max="9999" defaultValue={selectedGroup.sortOrder} required />
              {!selectedGroup.isSystem && <label className="toggle"><input name="isActive" type="checkbox" defaultChecked={selectedGroup.isActive} /> 활성</label>}
              <button className="button secondary" type="submit" disabled={pending === "update-group"}>{pending === "update-group" ? "저장 중…" : "그룹 저장"}</button>
            </form>
            <div className="code-list">
              {codes.map((code) => <form className={`code-row ${code.isActive ? "" : "inactive"}`} onSubmit={(event) => updateCode(event, code)} key={code.id}>
                <span className="mono code-value">{code.code}</span>
                <input name="label" aria-label={`${code.code} 명칭`} defaultValue={code.label} required maxLength={100} />
                <input name="sortOrder" aria-label={`${code.code} 순서`} type="number" min="0" max="9999" defaultValue={code.sortOrder} required />
                <label className="toggle"><input name="isActive" type="checkbox" defaultChecked={code.isActive} /> 활성</label>
                <button className="button secondary" type="submit" disabled={!!pending}>{pending === code.id ? "저장 중…" : "저장"}</button>
              </form>)}
              {!codes.length && <p className="empty">등록된 코드가 없습니다.</p>}
            </div>
            <form className="filter-bar" onSubmit={createCode}>
              <input name="code" placeholder="코드값" required maxLength={50} />
              <input name="label" placeholder="명칭" required maxLength={100} />
              <input name="sortOrder" type="number" min="0" max="9999" defaultValue={codes.length} required />
              <button className="button primary" type="submit" disabled={pending === "create-code"}>{pending === "create-code" ? "추가 중…" : "코드 추가"}</button>
            </form>
          </> : <p className="empty">좌측에서 코드 그룹을 선택하거나 새로 추가하세요.</p>}
        </section>
      </div>
    </div>
  </>;
}
