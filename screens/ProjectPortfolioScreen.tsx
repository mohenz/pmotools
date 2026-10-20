"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PORTFOLIO_STATUS_LABEL, sumMetrics, type PortfolioMetrics, type PortfolioStatus } from "@/lib/domain/project-portfolio";
import type { PortfolioProjectRow, ProjectPortfolio } from "@/lib/server/project-portfolio";

// 프로젝트 포트폴리오(PMO Daily 하위 탭) — 설계: docs/프로젝트 포트폴리오 관리 설계서.md 3장.
// 기존 통합 현황(/portfolio, 개인 대시보드)과 별개 화면이다.

const fmt = (value: number) => value.toLocaleString("ko-KR");
const pct = (value: number | null) => (value === null ? "–" : `${(value * 100).toFixed(1)}%`);
const dot = (value: string | null) => (value ? value.slice(2).replaceAll("-", ".") : "–");
const STATUS_BAND: Record<PortfolioStatus, string> = { PLANNED: "band-yellow", IN_PROGRESS: "band-green", COMPLETED: "" };
const DELAY_ALERT = 0.1; // 지연율 10% 이상 적색
const GAP_ALERT = 0.05; // 예상공정율 대비 5%p 이상 뒤처지면 적색

type SortKey = "order" | "name" | "code" | "status" | "total" | "completed" | "incomplete" | "delayed" | "expected" | "progress" | "delayRate";
const STATUS_ORDER: Record<PortfolioStatus, number> = { PLANNED: 0, IN_PROGRESS: 1, COMPLETED: 2 };

function sortValue(row: PortfolioProjectRow, key: SortKey): number | string {
  const m = row.rollup;
  switch (key) {
    case "name": return row.name;
    case "code": return row.code;
    case "status": return STATUS_ORDER[row.status];
    case "total": return m.totalCount;
    case "completed": return m.completedCount;
    case "incomplete": return m.incompleteCount;
    case "delayed": return m.delayedCount;
    case "expected": return m.expectedProgress ?? -1;
    case "progress": return m.progress ?? -1;
    case "delayRate": return m.delayRate ?? -1;
    default: return 0;
  }
}

function Gap({ metrics }: { metrics: PortfolioMetrics }) {
  if (metrics.progress === null || metrics.expectedProgress === null) return null;
  const gap = metrics.progress - metrics.expectedProgress;
  if (gap >= -0.0005) return null;
  return <small className={`portfolio-gap${-gap >= GAP_ALERT ? " critical" : ""}`}>▼{(-gap * 100).toFixed(1)}</small>;
}

export function ProjectPortfolioScreen({ data }: { data: ProjectPortfolio }) {
  const router = useRouter();
  const [status, setStatus] = useState<"" | PortfolioStatus>("");
  const [q, setQ] = useState("");
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "order", desc: false });
  const [message, setMessage] = useState("");

  const filtering = status !== "" || q.trim() !== "" || delayedOnly;
  const matches = (row: PortfolioProjectRow) => {
    const keyword = q.trim().toLowerCase();
    if (status && row.status !== status) return false;
    if (delayedOnly && row.rollup.delayedCount === 0) return false;
    if (keyword && ![row.name, row.code, row.customerPm, row.vendorPm].some((value) => value.toLowerCase().includes(keyword))) return false;
    return true;
  };

  const visibleRows = useMemo(() => {
    if (filtering || sort.key !== "order") {
      // 필터·정렬 중에는 계층을 펼친 평면 목록으로 보여 준다.
      const rows = data.rows.filter(matches);
      if (sort.key === "order") return rows;
      return [...rows].sort((a, b) => {
        const va = sortValue(a, sort.key), vb = sortValue(b, sort.key);
        const cmp = typeof va === "string" ? va.localeCompare(String(vb), "ko") : (va as number) - (vb as number);
        return sort.desc ? -cmp : cmp;
      });
    }
    const hiddenParents = new Set<string>();
    return data.rows.filter((row) => {
      if (row.parentId && hiddenParents.has(row.parentId)) { hiddenParents.add(row.id); return false; }
      if (collapsed.has(row.id)) hiddenParents.add(row.id);
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.rows, status, q, delayedOnly, collapsed, sort]);

  // 상단 합계 — 필터가 없으면 전체(대표 계층 모든 프로젝트 자기 지표 합), 있으면 화면에 남은 프로젝트의 자기 지표 합.
  const summary = filtering ? sumMetrics(data.rows.filter(matches).map((row) => row.own)) : data.total;
  const summaryRows = filtering ? data.rows.filter(matches) : data.rows;
  const statusCount = (s: PortfolioStatus) => summaryRows.filter((row) => row.status === s).length;

  const toggle = (id: string) => setCollapsed((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const sortBy = (key: SortKey) => setSort((prev) => ({ key, desc: prev.key === key ? !prev.desc : key !== "name" && key !== "code" }));
  const arrow = (key: SortKey) => (sort.key === key ? (sort.desc ? " ▼" : " ▲") : "");

  async function openWbsStats(row: PortfolioProjectRow) {
    setMessage("");
    const response = await fetch("/api/v1/mp/project", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: row.id }) });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setMessage(`${row.name}: ${payload?.error?.message ?? "WBS 통계로 이동할 수 없습니다."} (배정된 프로젝트만 WBS2에서 열 수 있습니다)`);
      return;
    }
    router.push("/mp-wbs/stats");
  }

  const th = (key: SortKey, label: string, numeric = true) => <th data-numeric={numeric || undefined}><button type="button" className="portfolio-sort" onClick={() => sortBy(key)}>{label}{arrow(key)}</button></th>;

  return <>
    <header className="topbar">
      <div><h1>프로젝트 포트폴리오</h1><p>대표 프로젝트: {data.rootName} · 하위 {data.rows.length - 1}개 · 기준 {new Date(data.asOf).toLocaleString("ko-KR")}</p></div>
      <div className="topbar-actions"><button type="button" className="button secondary" onClick={() => router.refresh()}>새로고침</button></div>
    </header>
    <div className="content project-portfolio">
      <section className="kpi-grid portfolio-kpis">
        <div className="kpi"><span>프로젝트</span><strong>{fmt(summaryRows.length)}</strong><small>예정 {statusCount("PLANNED")} · 진행 {statusCount("IN_PROGRESS")} · 완료 {statusCount("COMPLETED")}</small></div>
        <div className="kpi"><span>전체 Task</span><strong>{fmt(summary.totalCount)}</strong><small>미완료 {fmt(summary.incompleteCount)}</small></div>
        <div className="kpi"><span>완료 Task</span><strong>{fmt(summary.completedCount)}</strong><small>완료 ÷ 전체 = 공정율</small></div>
        <div className="kpi"><span>지연 Task</span><strong className={summary.delayedCount > 0 ? "critical" : undefined}>{fmt(summary.delayedCount)}</strong><small>계획일 도과 미착수·미완료</small></div>
        <div className="kpi"><span>공정율</span><strong>{pct(summary.progress)}</strong><small>예상공정율 {pct(summary.expectedProgress)}</small></div>
        <div className="kpi"><span>지연율</span><strong className={(summary.delayRate ?? 0) >= DELAY_ALERT ? "critical" : undefined}>{pct(summary.delayRate)}</strong><small>지연 {fmt(summary.delayedCount)} / 도래 {fmt(summary.delayTrackedCount)}</small></div>
      </section>

      <section className="panel">
        <div className="filters inline-filter portfolio-filters">
          <label>상태<select value={status} onChange={(e) => setStatus(e.target.value as "" | PortfolioStatus)}><option value="">전체</option>{(Object.keys(PORTFOLIO_STATUS_LABEL) as PortfolioStatus[]).map((s) => <option key={s} value={s}>{PORTFOLIO_STATUS_LABEL[s]}</option>)}</select></label>
          <label>검색<input type="search" value={q} placeholder="프로젝트명·코드·PM" onChange={(e) => setQ(e.target.value)} /></label>
          <label className="portfolio-check"><input type="checkbox" checked={delayedOnly} onChange={(e) => setDelayedOnly(e.target.checked)} />지연 있는 것만</label>
          {sort.key !== "order" && <button type="button" className="button secondary" onClick={() => setSort({ key: "order", desc: false })}>계층 순서로</button>}
        </div>
        {message && <p className="action-message portfolio-message">{message}</p>}
        <div className="table-wrap">
          <table className="portfolio-table">
            <thead><tr>
              {th("name", "프로젝트명", false)}{th("code", "코드", false)}<th>PM(고객/수행)</th><th>기간</th>{th("status", "상태", false)}
              {th("total", "전체")}{th("completed", "완료")}{th("incomplete", "미완료")}{th("delayed", "지연")}
              {th("expected", "예상공정율")}{th("progress", "공정율")}{th("delayRate", "지연율")}
            </tr></thead>
            <tbody>{visibleRows.map((row) => {
              const m = row.rollup;
              const flat = filtering || sort.key !== "order";
              return <tr key={row.id} className={row.hasChildren ? "portfolio-parent" : undefined}>
                <td>
                  <span className="portfolio-name" style={{ paddingLeft: flat ? 0 : row.depth * 18 }}>
                    {!flat && row.hasChildren ? <button type="button" className="portfolio-fold" aria-label={collapsed.has(row.id) ? "펼치기" : "접기"} onClick={() => toggle(row.id)}>{collapsed.has(row.id) ? "▸" : "▾"}</button> : <span className="portfolio-fold-space" />}
                    <button type="button" className="table-link portfolio-link" title="WBS 통계로 이동" onClick={() => openWbsStats(row)}>{row.name}</button>
                  </span>
                </td>
                <td className="mono">{row.code}</td>
                <td>{row.customerPm || "–"} / {row.vendorPm || "–"}</td>
                <td className="portfolio-period">{dot(row.startDate)}~{dot(row.endDate)}</td>
                <td><span className={`badge ${STATUS_BAND[row.status]}`}>{PORTFOLIO_STATUS_LABEL[row.status]}</span>{row.warning && <small className="portfolio-warning">{row.warning}</small>}</td>
                <td data-numeric>{fmt(m.totalCount)}</td>
                <td data-numeric>{fmt(m.completedCount)}</td>
                <td data-numeric>{fmt(m.incompleteCount)}</td>
                <td data-numeric className={m.delayedCount > 0 ? "critical" : undefined}>{fmt(m.delayedCount)}</td>
                <td data-numeric>{pct(m.expectedProgress)}</td>
                <td data-numeric>{pct(m.progress)} <Gap metrics={m} /></td>
                <td data-numeric className={(m.delayRate ?? 0) >= DELAY_ALERT ? "critical" : undefined}>{pct(m.delayRate)}</td>
              </tr>;
            })}</tbody>
          </table>
          {!visibleRows.length && <p className="empty">조건에 맞는 프로젝트가 없습니다.</p>}
        </div>
        <p className="portfolio-note">대표·상위 프로젝트 행은 하위 프로젝트를 합산한 값입니다. Leaf WBS 건수 기준 — 공정율 = 완료 ÷ 전체, 예상공정율 = 계획종료일이 오늘 이하인 Task ÷ 전체, 지연율 = 지연 Task ÷ 계획종료일이 오늘 이전인 Task. 공정율은 WBS 통계의 실적 공정율(작업기간 가중)과 다를 수 있습니다. 상태: 예정 &lt; 1%, 진행 ≥ 1%, 완료 = 전 Task 완료.</p>
      </section>
    </div>
  </>;
}

