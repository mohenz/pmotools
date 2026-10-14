"use client";

import { useState } from "react";

type ProjectOption = { id: string; code: string; name: string };

// 사용자별 프로젝트 배정 — 체크한 프로젝트가 배정, 해제한 프로젝트는 배정 해제(소속 비활성, 이력 보존).
// 관리자 이상은 배정 없이도 모든 프로젝트에 접근하므로 안내만 표시하고, 담당자 목록 노출용으로 배정할 수 있다.
export function ProjectAssignment({ label, role, projects, assignedIds, pending, onSave }: { label: string; role: string; projects: ProjectOption[]; assignedIds: string[]; pending: boolean; onSave: (projectIds: string[]) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(assignedIds);
  const allAccess = role === "SUPER_ADMIN" || role === "ADMIN";
  const assigned = projects.filter((project) => assignedIds.includes(project.id));
  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return <div className="project-assignment">
    <div className="project-assignment-chips">
      {allAccess && <span className="badge level-pm" title="관리자 이상은 모든 프로젝트에 접근합니다">전체 접근</span>}
      {assigned.map((project) => <span className="badge" key={project.id} title={project.name}>{project.code}</span>)}
      {!allAccess && !assigned.length && <span className="badge issue">배정 없음</span>}
      <button className="button secondary" type="button" disabled={pending} onClick={() => { setSelected(assignedIds); setOpen((v) => !v); }} aria-expanded={open} aria-label={`${label} 프로젝트 배정`}>배정</button>
    </div>
    {open && <div className="project-assignment-panel" role="dialog" aria-label={`${label} 프로젝트 배정`}>
      {allAccess && <p className="group-description">관리자 이상은 배정 없이도 모든 프로젝트에 접근합니다. 담당자·참석자 목록에 나오게 하려면 배정하십시오.</p>}
      <div className="project-assignment-list">
        {projects.map((project) => <label className="checkbox-chip" key={project.id}><input type="checkbox" checked={selected.includes(project.id)} onChange={() => toggle(project.id)} /> {project.name} <span className="mono">({project.code})</span></label>)}
      </div>
      <div className="alert-dialog-actions">
        <button className="button secondary" type="button" onClick={() => setOpen(false)}>취소</button>
        <button className="button primary" type="button" disabled={pending} onClick={async () => { if (await onSave(selected)) setOpen(false); }}>{pending ? "저장 중…" : `저장 (${selected.length}개)`}</button>
      </div>
    </div>}
  </div>;
}
