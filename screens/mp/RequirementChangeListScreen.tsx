// [WBS2 복사본] 원본: screens/RequirementChangeListScreen.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import Link from "next/link";
import { changeStatusLabels } from "@/lib/domain/requirements";
import type { RequirementChangeRow } from "@/lib/server/mp/requirements";
import { RequirementChangeActions } from "@/features/mp/requirements/RequirementChangeActions";

type Filters = { status: string; page: number };
type Result = { changes: RequirementChangeRow[]; total: number; page: number; pageSize: number; totalPages: number };

function queryString(filters: Filters, overrides: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...overrides }).forEach(([key, value]) => {
    if (value !== "" && value != null && !(key === "page" && value === 1)) params.set(key, String(value));
  });
  return params.toString();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(value));
}

export function RequirementChangeListScreen({ result, filters }: { result: Result; filters: Filters }) {
  return <>
    <header className="topbar"><div><h1>요구사항변경관리</h1><p>총 {result.total}건</p></div></header>
    <div className="content">
      <form className="filters" method="get">
        <select name="status" defaultValue={filters.status} aria-label="처리상태"><option value="">전체 상태</option>{Object.entries(changeStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
        <button className="button secondary" type="submit">조회</button>
      </form>
      <section className="panel compact">
        {result.changes.length ? <div className="change-list">{result.changes.map((change) => <article className="panel compact" key={change.id}>
          <div className="detail-badges">
            <span className="badge">{changeStatusLabels[change.status]}</span>
            <Link className="mono table-link requirement-id" href={`/mp-requirements/${change.requirementId}`}>{change.requirementManualId || "요구사항 ID 미입력"}</Link>
            <time>{formatDate(change.requestedAt)}</time>
          </div>
          <p><strong>{change.title}</strong> — <Link className="table-link" href={`/mp-requirements/${change.requirementId}`}>{change.requirementTitle}</Link></p>
          <p>{change.requestedByName} · {change.changeReason}</p>
          {change.decidedByName && <small>{change.decidedByName}이(가) {formatDate(change.decidedAt!)}에 처리{change.decisionNote ? ` · ${change.decisionNote}` : ""}</small>}
          {change.status === "pending" && <RequirementChangeActions changeId={change.id} />}
        </article>)}</div> : <div className="empty">조건에 맞는 변경요청이 없습니다.</div>}
      </section>
      {result.totalPages > 1 && <nav className="pagination" aria-label="페이지 이동">
        {result.page > 1 ? <Link href={`/mp-requirements/changes?${queryString(filters, { page: result.page - 1 })}`}>이전</Link> : <span />}
        <strong>{result.page} / {result.totalPages}</strong>
        {result.page < result.totalPages ? <Link href={`/mp-requirements/changes?${queryString(filters, { page: result.page + 1 })}`}>다음</Link> : <span />}
      </nav>}
    </div>
  </>;
}
