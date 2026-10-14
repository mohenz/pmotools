"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProjectSummary } from "@/lib/server/projects-admin";
import { firstNumberOf } from "@/lib/domain/numbering";
import { WarningDialog } from "@/components/WarningDialog";

export function ProjectManagementScreen({ projects }: { projects: ProjectSummary[] }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form);
    setPending("create"); setMessage("");
    const response = await fetch("/api/v1/admin/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: data.get("code"), name: data.get("name"), parentId: data.get("parentId") || null }),
    });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "프로젝트를 생성하지 못했습니다."); return; }
    // 생성은 코드·이름·상위만 받고, 기간·오픈·조직 정보는 바로 정보 수정 화면에서 입력한다.
    form.reset(); router.push(`/settings/projects/${payload.data.id}`);
  }

  async function updateParent(projectId: string, parentId: string) {
    setPending(projectId); setMessage("");
    const response = await fetch(`/api/v1/admin/projects/${projectId}/parent`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parentId: parentId || null }),
    });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "상위 프로젝트를 저장하지 못했습니다."); return; }
    router.refresh();
  }

  async function updateVisibility(projectId: string, isPublic: boolean) {
    setPending(projectId); setMessage("");
    const response = await fetch(`/api/v1/admin/projects/${projectId}/visibility`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isPublic }),
    });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "로그인 노출 여부를 저장하지 못했습니다."); return; }
    router.refresh();
  }

  // 노출 우선순위 — 한 칸 옮긴 전체 순서를 저장한다(프로젝트 관리 목록·프로젝트 전환·WBS2 대상 프로젝트 선택에 공통 적용)
  async function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= projects.length) return;
    const ids = projects.map((p) => p.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setPending("reorder"); setMessage("");
    const response = await fetch("/api/v1/admin/projects/reorder", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderedIds: ids }) });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "순서를 저장하지 못했습니다."); return; }
    router.refresh();
  }

  return <>
    <header className="topbar"><div><h1>프로젝트 관리</h1><p>PMOTOOLS 플랫폼에서 운영되는 전체 프로젝트를 생성하고, 프로젝트 정보와 상하위 관계를 관리합니다.</p></div></header>
    <div className="content settings-content">
      <WarningDialog message={message} onClose={() => setMessage("")} />
      <section className="panel">
        <div className="panel-head"><h2>신규 프로젝트</h2></div>
        <form className="filter-bar" onSubmit={createProject}>
          <input name="code" placeholder="프로젝트 코드 (예: PMO2026)" required maxLength={50} />
          <input name="name" placeholder="프로젝트명" required maxLength={150} />
          <select name="parentId" aria-label="상위 프로젝트" defaultValue="">
            <option value="">상위 프로젝트 없음</option>
            {projects.map((p) => <option value={p.id} key={p.id}>{p.name} ({p.code})</option>)}
          </select>
          <button className="button primary" type="submit" disabled={pending === "create"}>{pending === "create" ? "생성 중…" : "생성"}</button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>전체 프로젝트 목록</h2><span>{projects.length}개 · ↑↓ 순서는 프로젝트 전환 목록과 WBS2 대상 프로젝트 선택에도 적용됩니다</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>순서</th><th>코드</th><th>프로젝트명</th><th>로그인 노출</th><th>상위 프로젝트</th><th>기간</th><th>발주사</th><th>수행사 PM</th><th>번호 시작점</th><th>소속 인원</th><th>생성일</th><th>관리</th></tr></thead>
            <tbody>
              {projects.map((project, index) => <tr key={project.id}>
                <td className="project-order">
                  <button className="button secondary" type="button" disabled={index === 0 || pending === "reorder"} onClick={() => move(index, -1)} aria-label={`${project.name} 위로`}>↑</button>
                  <button className="button secondary" type="button" disabled={index === projects.length - 1 || pending === "reorder"} onClick={() => move(index, 1)} aria-label={`${project.name} 아래로`}>↓</button>
                </td>
                <td className="mono">{project.code}</td>
                <td><Link className="table-link" href={`/settings/projects/${project.id}`}>{project.name}</Link></td>
                <td>
                  <label className="toggle"><input type="checkbox" defaultChecked={project.isPublic} disabled={pending === project.id} onChange={(e) => updateVisibility(project.id, e.target.checked)} /><span>노출</span></label>
                </td>
                <td>
                  <select aria-label={`${project.name} 상위 프로젝트`} defaultValue={project.parentId ?? ""} disabled={pending === project.id} onChange={(event) => updateParent(project.id, event.target.value)}>
                    <option value="">없음</option>
                    {projects.filter((p) => p.id !== project.id).map((p) => <option value={p.id} key={p.id}>{p.name} ({p.code})</option>)}
                  </select>
                </td>
                <td className="mono">{project.startDate && project.endDate ? `${project.startDate} ~ ${project.endDate}` : "미입력"}</td>
                <td>{project.customerName || "-"}</td>
                <td>{project.vendorPm || "-"}</td>
                <td className="mono">{project.numberingBase === null ? <span className="critical">미지정</span> : firstNumberOf(project.numberingBase)}</td>
                <td>{project.memberCount}명</td>
                <td>{project.createdAt.slice(0, 10)}</td>
                <td><Link className="button secondary" href={`/settings/projects/${project.id}`}>정보 수정</Link></td>
              </tr>)}
              {!projects.length && <tr><td colSpan={12} className="empty">등록된 프로젝트가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </>;
}
