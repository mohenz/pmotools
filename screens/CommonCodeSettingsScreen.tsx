"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { CommonCode, CommonCodeGroup } from "@/lib/server/common-codes";

type Props = { groups: CommonCodeGroup[]; selectedGroup: CommonCodeGroup | null; codes: CommonCode[] };

export function CommonCodeSettingsScreen({ groups, selectedGroup, codes }: Props) {
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
    const created = await request("/api/v1/settings/common-code-groups", "POST", {
      code: data.get("code"), label: data.get("label"), description: data.get("description"), sortOrder: Number(data.get("sortOrder")),
    }, "create-group");
    if (created?.id) { form.reset(); router.push(`/settings/common-codes?group=${created.id}`); }
  }

  async function updateGroup(event: FormEvent<HTMLFormElement>) {
    if (!selectedGroup) return;
    event.preventDefault(); const data = new FormData(event.currentTarget);
    await request(`/api/v1/settings/common-code-groups/${selectedGroup.id}`, "PATCH", {
      label: data.get("label"), description: data.get("description"), sortOrder: Number(data.get("sortOrder")),
      isActive: selectedGroup.isSystem || data.get("isActive") === "on",
    }, "update-group");
  }

  async function createCode(event: FormEvent<HTMLFormElement>) {
    if (!selectedGroup) return;
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const success = await request("/api/v1/settings/common-codes", "POST", {
      groupId: selectedGroup.id, code: data.get("code"), label: data.get("label"), sortOrder: Number(data.get("sortOrder")),
      minScore: selectedGroup.code === "escalation_level" ? Number(data.get("minScore")) : null,
    }, "create-code");
    if (success) form.reset();
  }

  async function updateCode(event: FormEvent<HTMLFormElement>, code: CommonCode) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    await request(`/api/v1/settings/common-codes/${code.id}`, "PATCH", {
      label: data.get("label"), sortOrder: Number(data.get("sortOrder")), isActive: data.get("isActive") === "on",
      minScore: code.groupCode === "escalation_level" ? Number(data.get("minScore")) : null,
    }, code.id);
  }

  const escalation = selectedGroup?.code === "escalation_level";
  return <>
    <header className="topbar"><div><h1>공통코드 설정</h1><p>코드 그룹을 선택한 후 그룹에 속한 코드를 관리합니다.</p></div></header>
    <div className="content settings-content">
      {message && <p className="form-error action-message" role="alert">{message}</p>}
      <div className="group-settings-layout">
        <aside className="panel group-list-panel">
          <div className="panel-head"><h2>코드 그룹</h2><span>{groups.length}개</span></div>
          <nav className="group-list" aria-label="코드 그룹 목록">
            {groups.map((group) => <Link className={`group-list-item ${group.id === selectedGroup?.id ? "active" : ""} ${group.isActive ? "" : "inactive"}`} href={`/settings/common-codes?group=${group.id}`} key={group.id}>
              <span><strong>{group.label}</strong><small className="mono">{group.code}</small></span>
              <em>{group.activeCodeCount}/{group.codeCount}</em>
            </Link>)}
          </nav>
          <form className="group-add" onSubmit={createGroup}>
            <h3>그룹 추가</h3>
            <label>그룹 코드<input name="code" placeholder="예: category" pattern="[A-Za-z][A-Za-z0-9_-]*" required maxLength={50} /></label>
            <label>그룹 명칭<input name="label" placeholder="예: 이슈 유형" required maxLength={100} /></label>
            <label>설명<input name="description" placeholder="설명 (선택)" maxLength={300} /></label>
            <label>표시 순서<input name="sortOrder" type="number" min="0" max="9999" defaultValue="99" required /></label>
            <button className="button secondary" type="submit" disabled={!!pending}>{pending === "create-group" ? "추가 중…" : "+ 그룹 추가"}</button>
          </form>
        </aside>

        {selectedGroup ? <div className="group-editor">
          <section className="panel">
            <div className="panel-head"><div><h2>{selectedGroup.label}</h2><p className="group-description">그룹 정보와 사용 상태를 관리합니다.</p></div>{selectedGroup.isSystem && <span className="badge">시스템 그룹</span>}</div>
            <form className="group-editor-form" onSubmit={updateGroup}>
              <label>그룹 코드<input value={selectedGroup.code} disabled className="mono" /></label>
              <label>그룹 명칭<input name="label" defaultValue={selectedGroup.label} required maxLength={100} /></label>
              <label className="wide">설명<input name="description" defaultValue={selectedGroup.description ?? ""} maxLength={300} /></label>
              <label>표시 순서<input name="sortOrder" type="number" min="0" max="9999" defaultValue={selectedGroup.sortOrder} required /></label>
              <label className="toggle group-active"><input name="isActive" type="checkbox" defaultChecked={selectedGroup.isActive} disabled={selectedGroup.isSystem} /> 활성 그룹</label>
              <button className="button primary" type="submit" disabled={!!pending}>{pending === "update-group" ? "저장 중…" : "그룹 저장"}</button>
            </form>
          </section>

          <section className="panel code-group">
            <div className="panel-head"><div><h2>소속 코드</h2><p>이 그룹에서 사용할 코드만 한 곳에서 관리합니다.</p></div><span>{codes.length}개</span></div>
            {codes.length > 0 && <div className={`code-row code-row-head ${escalation ? "with-score" : ""}`} aria-hidden="true">
              <span>코드</span><span>명칭</span><span>순서</span>{escalation && <span>최소 점수</span>}<span>활성</span><span />
            </div>}
            <div className={`code-list ${escalation ? "with-score" : ""}`}>
              {codes.map((code) => <form className={`code-row ${code.isActive ? "" : "inactive"}`} onSubmit={(event) => updateCode(event, code)} key={code.id}>
                <span className="mono code-value">{code.code}</span>
                <input name="label" aria-label={`${code.code} 명칭`} defaultValue={code.label} required maxLength={100} />
                <input name="sortOrder" aria-label={`${code.code} 순서`} type="number" min="0" max="9999" defaultValue={code.sortOrder} required />
                {escalation && <input name="minScore" aria-label={`${code.code} 최소 점수`} type="number" min="1" max="9" defaultValue={code.minScore ?? 1} required />}
                <label className="toggle"><input name="isActive" type="checkbox" defaultChecked={code.isActive} /> 활성</label>
                <button className="button secondary" type="submit" disabled={!!pending}>{pending === code.id ? "저장 중…" : "저장"}</button>
              </form>)}
              {!codes.length && <p className="empty">이 그룹에 등록된 코드가 없습니다.</p>}
            </div>
            <form className={`code-row code-create ${escalation ? "with-score" : ""}`} onSubmit={createCode}>
              <input name="code" aria-label="신규 코드" placeholder="신규 코드" pattern="[A-Za-z][A-Za-z0-9_-]*" required maxLength={50} />
              <input name="label" aria-label="신규 코드 명칭" placeholder="표시 명칭" required maxLength={100} />
              <input name="sortOrder" aria-label="신규 코드 순서" type="number" min="0" max="9999" defaultValue="99" required />
              {escalation && <input name="minScore" aria-label="신규 최소 점수" type="number" min="1" max="9" defaultValue="1" required />}
              <span />
              <button className="button primary" type="submit" disabled={!!pending}>{pending === "create-code" ? "추가 중…" : "+ 코드 추가"}</button>
            </form>
          </section>
        </div> : <section className="panel empty">코드 그룹을 추가해 주세요.</section>}
      </div>
    </div>
  </>;
}
