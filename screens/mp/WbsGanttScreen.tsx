"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { addDays, dayIndex, GANTT_DAY_WIDTH, ganttRange, ganttTicks, isGanttProjectRow, type GanttRow, type GanttState, type GanttUnit } from "@/lib/domain/mp/gantt";

// WBS2 간트 차트(조회 전용, 2026-09-30) — 결정: WBS2에만 · 조회 전용 · 기본 주 단위·2단계 펼침 · 통합 간트 없음.
// 1,700행 이상도 가볍게: 행 높이 고정 + 보이는 행만 그린다. 왼쪽 작업 목록은 가로 스크롤해도 고정(sticky).

type Filters = { q: string; assignee: string; stage: string; delayed: boolean; cp: boolean; excludeCompleted: boolean };

const LEFT = 460, RH = 30, HEADER = 50, BUFFER = 12;
const UNITS: { value: GanttUnit; label: string }[] = [{ value: "day", label: "일" }, { value: "week", label: "주" }, { value: "month", label: "월" }, { value: "quarter", label: "분기" }];
const STATE_LABEL: Record<GanttState, string> = { completed: "완료", delayedCompletion: "지연완료", delayed: "지연", inProgress: "진행", notStarted: "미착수" };
const pct = (value: number) => `${Math.round(value * 100)}%`;
const dot = (value: string | null) => (value ? value.replaceAll("-", ".") : "-");

// projectCount > 0 — 최상위 프로젝트 통합 간트(프로젝트 요약 행이 맨 위 단계). 기본 펼침을 한 단계 더 열어 프로젝트 아래 단계까지 보인다.
export function WbsGanttScreen({ rows, holidays, today, stages, cpMinWorkingDays, filters, restricted, projectCount = 0 }: { rows: GanttRow[]; holidays: string[]; today: string; stages: string[]; cpMinWorkingDays: number; filters: Filters; restricted: boolean; projectCount?: number }) {
  const [unit, setUnit] = useState<GanttUnit>("week");
  const [expandLevel, setExpandLevel] = useState(projectCount ? 3 : 2);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [showActual, setShowActual] = useState(true);
  const [printing, setPrinting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, height: 700 });

  const range = useMemo(() => ganttRange(rows, today), [rows, today]);
  const ticks = useMemo(() => ganttTicks(range, unit), [range, unit]);
  const dw = GANTT_DAY_WIDTH[unit];
  const width = range.days * dw;
  const x = useCallback((date: string) => dayIndex(range.start, date) * dw, [range.start, dw]);

  // 펼침: 기본은 expandLevel 단계까지(깊이 < expandLevel-1 인 단계가 열림), 사용자가 누른 행은 개별 설정 우선
  const isOpen = useCallback((row: GanttRow) => overrides[row.id] ?? row.depth < expandLevel - 1, [overrides, expandLevel]);
  const visible = useMemo(() => {
    const out: GanttRow[] = [];
    let hiddenBelow = Infinity;
    for (const row of rows) {
      if (row.depth > hiddenBelow) continue;
      hiddenBelow = Infinity;
      out.push(row);
      if (row.hasChildren && !isOpen(row)) hiddenBelow = row.depth;
    }
    return out;
  }, [rows, isOpen]);

  // 주말·휴일 음영(일·주 단위에서만) — 연속된 날은 한 덩어리로
  const shades = useMemo(() => {
    if (unit !== "day" && unit !== "week") return [];
    const holidaySet = new Set(holidays), blocks: { offset: number; days: number }[] = [];
    for (let i = 0; i < range.days; i += 1) {
      const date = addDays(range.start, i), weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      if (weekday !== 0 && weekday !== 6 && !holidaySet.has(date)) continue;
      const last = blocks[blocks.length - 1];
      if (last && last.offset + last.days === i) last.days += 1; else blocks.push({ offset: i, days: 1 });
    }
    return blocks;
  }, [unit, holidays, range]);

  const scrollToToday = useCallback(() => { const el = scrollRef.current; if (el) el.scrollLeft = Math.max(0, x(today) - 240); }, [x, today]);
  useLayoutEffect(() => { scrollToToday(); }, [scrollToToday]);
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    let frame = 0;
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => setView({ top: el.scrollTop, height: el.clientHeight })); };
    onScroll(); el.addEventListener("scroll", onScroll, { passive: true }); window.addEventListener("resize", onScroll);
    return () => { el.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(frame); };
  }, []);
  useEffect(() => {
    const before = () => setPrinting(true), after = () => setPrinting(false);
    window.addEventListener("beforeprint", before); window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);

  const first = printing ? 0 : Math.max(0, Math.floor(view.top / RH) - BUFFER);
  const last = printing ? visible.length : Math.min(visible.length, Math.ceil((view.top + view.height) / RH) + BUFFER);
  const bodyHeight = visible.length * RH;
  const todayX = x(today);

  return <>
    <header className="topbar"><div><h1>WBS 간트 차트</h1><p>{projectCount > 0 && `최상위 통합 ${projectCount}개 프로젝트 · `}{rows.length}개 항목 · 표시 {visible.length}행 · 조회 전용(막대·Task명을 누르면 상세)</p></div></header>
    <div className="content gantt-content">
      <form className="filters inline-filter gantt-filters" method="get">
        <input name="q" defaultValue={filters.q} placeholder="Task 코드·이름" aria-label="Task 검색" />
        <input name="assignee" defaultValue={filters.assignee} placeholder="담당자" aria-label="담당자 검색" />
        <select name="stage" defaultValue={filters.stage} aria-label="Stage"><option value="">전체 Stage</option>{stages.map((stage) => <option value={stage} key={stage}>{stage}</option>)}</select>
        <label className="gantt-check"><input type="checkbox" name="delayed" value="y" defaultChecked={filters.delayed} /> 지연만</label>
        <label className="gantt-check"><input type="checkbox" name="cp" value="y" defaultChecked={filters.cp} /> CP 대상({cpMinWorkingDays}일 이상)</label>
        <label className="gantt-check"><input type="checkbox" name="excludeCompleted" value="y" defaultChecked={filters.excludeCompleted} /> 완료 제외</label>
        <button className="button secondary" type="submit">조회</button>
        <Link className="button ghost" href="/mp-wbs/gantt">초기화</Link>
      </form>

      <div className="gantt-toolbar">
        <div className="gantt-segment" role="group" aria-label="기간 단위">{UNITS.map((u) => <button type="button" key={u.value} className={unit === u.value ? "active" : ""} aria-pressed={unit === u.value} onClick={() => setUnit(u.value)}>{u.label}</button>)}</div>
        <div className="gantt-segment" role="group" aria-label="펼침 단계">{(projectCount ? [1, 2, 3, 4, 5] : [1, 2, 3, 4]).map((level) => <button type="button" key={level} className={expandLevel === level ? "active" : ""} aria-pressed={expandLevel === level} onClick={() => { setExpandLevel(level); setOverrides({}); }}>{level}단계</button>)}</div>
        <label className="gantt-check"><input type="checkbox" checked={showActual} onChange={(e) => setShowActual(e.target.checked)} /> 실적 기간 표시</label>
        <button type="button" className="button secondary" onClick={scrollToToday}>오늘로 이동</button>
        <button type="button" className="button secondary" onClick={() => window.print()}>인쇄</button>
        <span className="gantt-legend">{(["completed", "inProgress", "delayed", "delayedCompletion", "notStarted"] as GanttState[]).map((state) => <span key={state}><i className={`gantt-swatch state-${state}`} />{STATE_LABEL[state]}</span>)}<span><i className="gantt-swatch milestone" />마일스톤</span></span>
      </div>
      {restricted && <p className="gantt-note">일반 사용자는 본인 담당 Task와 그 상위 단계만 표시됩니다.</p>}

      <div className={`gantt-scroll${printing ? " printing" : ""}`} ref={scrollRef}>
        <div className="gantt-canvas" style={{ width: LEFT + width, height: HEADER + bodyHeight }}>
          <div className="gantt-header" style={{ width: LEFT + width, height: HEADER }}>
            <div className="gantt-corner" style={{ width: LEFT }}><span className="gantt-col-code">코드</span><span className="gantt-col-name">Task명</span><span className="gantt-col-owner">담당</span><span className="gantt-col-pct">진척</span></div>
            <div className="gantt-ticks" style={{ left: LEFT, width }}>
              {ticks.top.map((t) => <div className="gantt-tick top" key={`t${t.offset}`} style={{ left: t.offset * dw, width: t.days * dw }}>{t.days * dw > 28 ? t.label : ""}</div>)}
              {ticks.bottom.map((t) => <div className="gantt-tick bottom" key={`b${t.offset}`} style={{ left: t.offset * dw, width: t.days * dw }}>{t.days * dw >= 18 ? t.label : ""}</div>)}
            </div>
          </div>
          <div className="gantt-body" style={{ height: bodyHeight }}>
            {shades.map((s) => <div className="gantt-shade" key={s.offset} style={{ left: LEFT + s.offset * dw, width: s.days * dw }} />)}
            {todayX >= 0 && todayX <= width && <div className="gantt-today" style={{ left: LEFT + todayX + dw / 2 }} title={`오늘 ${today}`} />}
            {visible.slice(first, last).map((row, i) => <Row key={row.id} row={row} top={(first + i) * RH} x={x} dw={dw} width={width} today={today} showActual={showActual}
              open={row.hasChildren ? isOpen(row) : undefined} onToggle={() => setOverrides((prev) => ({ ...prev, [row.id]: !isOpen(row) }))} />)}
            {!visible.length && <p className="empty gantt-empty">조건에 맞는 WBS 항목이 없습니다.</p>}
          </div>
        </div>
      </div>
    </div>
  </>;
}

function Row({ row, top, x, dw, width, today, showActual, open, onToggle }: { row: GanttRow; top: number; x: (date: string) => number; dw: number; width: number; today: string; showActual: boolean; open?: boolean; onToggle: () => void }) {
  const tip = [
    `${row.code} ${row.name}`,
    `계획 ${dot(row.start)} ~ ${dot(row.due)}${row.workingDays !== null ? ` (${row.workingDays}영업일)` : ""}`,
    row.isLeaf ? `실적 ${dot(row.actualStart)} ~ ${dot(row.actualDue)}` : "상위 단계 요약(하위 Task 기준)",
    `목표 ${pct(row.planned)} · 실적 ${pct(row.actual)} · ${STATE_LABEL[row.state]}${row.delayDays ? ` · 지연 ${row.delayDays}일` : ""}`,
    row.ownerName ? `담당 ${row.ownerName}` : "",
  ].filter(Boolean).join("\n");
  const barLeft = row.start ? x(row.start) : null;
  const barWidth = row.start && row.due ? Math.max(dw, (dayIndex(row.start, row.due) + 1) * dw) : 0;
  const actualEnd = row.actualDue ?? (row.actualStart ? today : null);
  return <div className={`gantt-row depth-${row.depth}${row.isLeaf ? "" : " summary"}`} style={{ top, width: LEFT + width, height: RH }}>
    <div className="gantt-left" style={{ width: LEFT }}>
      <span className="gantt-col-code mono">{row.code}</span>
      <span className="gantt-col-name" style={{ paddingLeft: row.depth * 14 }}>
        {open === undefined ? <span className="gantt-toggle-space" /> : <button type="button" className="gantt-toggle" aria-expanded={open} aria-label={`${row.name} ${open ? "접기" : "펼치기"}`} onClick={onToggle}>{open ? "▾" : "▸"}</button>}
        {isGanttProjectRow(row.id) ? <strong title={tip}>{row.name} <small className="gantt-project-code">{row.code}</small></strong> : <Link className="table-link" href={`/mp-wbs/${row.id}`} title={tip}>{row.name}</Link>}
      </span>
      <span className="gantt-col-owner">{row.ownerName ?? ""}</span>
      <span className={`gantt-col-pct state-text-${row.state}`}>{pct(row.actual)}</span>
    </div>
    {barLeft !== null && (row.milestone
      ? <Link href={`/mp-wbs/${row.id}`} className={`gantt-milestone state-${row.state}`} style={{ left: LEFT + barLeft + dw / 2 - 7 }} title={tip} aria-label={`${row.name} 마일스톤`} />
      : isGanttProjectRow(row.id) ? <span className={`gantt-bar state-${row.state} summary project`} style={{ left: LEFT + barLeft, width: barWidth }} title={tip} aria-label={`${row.name} 일정`} />
      : <Link href={`/mp-wbs/${row.id}`} className={`gantt-bar state-${row.state}${row.isLeaf ? "" : " summary"}`} style={{ left: LEFT + barLeft, width: barWidth }} title={tip} aria-label={`${row.name} 일정`}>
          <span className="gantt-fill" style={{ width: pct(Math.min(1, row.actual)) }} />
        </Link>)}
    {showActual && row.isLeaf && row.actualStart && actualEnd && <div className="gantt-actual" style={{ left: LEFT + x(row.actualStart), width: Math.max(dw, (dayIndex(row.actualStart, actualEnd) + 1) * dw) }} title={`실적 ${dot(row.actualStart)} ~ ${row.actualDue ? dot(row.actualDue) : "진행 중"}`} />}
    {row.isLeaf && row.state === "delayed" && row.delayDays && barLeft !== null && <span className="gantt-delay-label" style={{ left: LEFT + barLeft + barWidth + 6 }}>지연 {row.delayDays}일</span>}
  </div>;
}
