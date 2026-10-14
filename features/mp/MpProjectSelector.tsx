"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, House } from "lucide-react";
import type { MpProjectOption } from "@/lib/server/mp/context";

// WBS2 · WBS상세내용2 · 요구사항관리2 상단의 대상 프로젝트 선택 — 로그인 프로젝트(세션)는 바뀌지 않는다.
// 2026-10-02: 기본 <select>는 목록 안에 아이콘·툴팁을 넣을 수 없어 직접 만든 드롭다운(listbox)으로 교체.
//   소속(로그인) 프로젝트는 "· 로그인 프로젝트" 글자 대신 집 아이콘으로 표시하고, 마우스를 올리면 "소속 프로젝트" 툴팁.
//   키보드: 열기 Enter·Space·↓, 이동 ↑↓·Home·End, 선택 Enter·Space, 닫기 Esc·Tab, 바깥 클릭 시 닫힘.
const LOGIN_TOOLTIP = "소속 프로젝트";

function LoginProjectIcon() {
  return <span className="mp-login-icon" role="img" aria-label={LOGIN_TOOLTIP} data-tooltip={LOGIN_TOOLTIP}><House aria-hidden="true" /></span>;
}

export function MpProjectSelector({ projects, currentId, listHref }: { projects: MpProjectOption[]; currentId: string; listHref: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, projects.findIndex((project) => project.id === currentId)));
  const rootRef = useRef<HTMLDivElement>(null), buttonRef = useRef<HTMLButtonElement>(null), listRef = useRef<HTMLUListElement>(null);
  const listId = useId(), labelId = useId();
  const current = projects.find((project) => project.id === currentId);
  const disabled = pending || projects.length < 2;

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);
  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  async function change(projectId: string) {
    setOpen(false); buttonRef.current?.focus();
    if (projectId === currentId) return;
    setPending(true); setError("");
    const response = await fetch("/api/v1/mp/project", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId }) });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) { setError(payload?.error?.message ?? "프로젝트를 바꾸지 못했습니다."); return; }
    // 상세·수정 화면의 id는 다른 프로젝트에 없으므로 기능의 첫 화면(목록)으로 이동한다.
    router.push(listHref); router.refresh();
  }

  function openList() {
    setActive(Math.max(0, projects.findIndex((project) => project.id === currentId)));
    setOpen(true);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); openList(); }
      return;
    }
    const last = projects.length - 1;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((i) => Math.min(last, i + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (event.key === "Home") { event.preventDefault(); setActive(0); }
    else if (event.key === "End") { event.preventDefault(); setActive(last); }
    else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void change(projects[active].id); }
    else if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
    else if (event.key === "Tab") setOpen(false);
  }

  return <div className="mp-project-bar">
    <div className="mp-project-select" ref={rootRef}>
      <span id={labelId} className="mp-project-label">대상 프로젝트</span>
      <div className="mp-project-control">
      <button ref={buttonRef} type="button" className="mp-project-trigger" aria-label="대상 프로젝트 선택" aria-haspopup="listbox" aria-expanded={open}
        aria-controls={listId} aria-activedescendant={open ? `${listId}-${active}` : undefined} disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())} onKeyDown={onKeyDown}>
        <span className="mp-project-current">{current ? <>{current.name} ({current.code})</> : "프로젝트 선택"}</span>
        {current?.isLoginProject && <LoginProjectIcon />}
        <ChevronDown className="mp-project-chevron" aria-hidden="true" />
      </button>
      {open && <ul ref={listRef} id={listId} role="listbox" aria-labelledby={labelId} className="mp-project-list">
        {projects.map((project, index) => <li key={project.id} id={`${listId}-${index}`} data-index={index} role="option" aria-selected={project.id === currentId}
          className={`mp-project-option${index === active ? " active" : ""}${project.id === currentId ? " selected" : ""}`}
          style={{ paddingLeft: 12 + project.depth * 16 }} onMouseEnter={() => setActive(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => void change(project.id)}>
          {project.depth > 0 && <span className="mp-project-branch" aria-hidden="true">└</span>}
          <span>{project.name} <small>({project.code})</small></span>
          {project.isLoginProject && <LoginProjectIcon />}
        </li>)}
      </ul>}
      </div>
    </div>
    {projects.length < 2 && <small>선택 가능한 하위 프로젝트가 없습니다. 하위 프로젝트에 소속되면 여기에서 바꿀 수 있습니다.</small>}
    {error && <small className="mp-project-error" role="alert">{error}</small>}
  </div>;
}
