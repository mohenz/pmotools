import Link from "next/link";
import type { CommonCode } from "@/lib/server/common-codes";
import type { ManagementTaskFilters, ManagementTaskRow } from "@/lib/server/management-tasks";
import { ManagementTaskTable } from "./ManagementTaskDashboardScreen";

type Filters = Required<Pick<ManagementTaskFilters, "q" | "groupId" | "band" | "page">>;
type Result = { tasks: ManagementTaskRow[]; total: number; page: number; pageSize: number; totalPages: number };

function queryString(filters: Filters, overrides: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...overrides }).forEach(([key, value]) => {
    if (value !== "" && value != null && !(key === "page" && value === 1)) params.set(key, String(value));
  });
  return params.toString();
}

export function ManagementTaskListScreen({ result, filters, groups }: { result: Result; filters: Filters; groups: CommonCode[] }) {
  return <>
    <header className="topbar"><div><h1>프로젝트통합모니터링</h1><p>총 {result.total}건 · 관리업무항목 전체 목록</p></div><div className="topbar-actions"><Link className="button secondary" href="/management-tasks/dashboard">대시보드</Link></div></header>
    <div className="content">
      {filters.band && <div className="active-filter"><span>대시보드 조건이 적용되었습니다.</span><Link href="/management-tasks">전체 조건 해제</Link></div>}
      <form className="filters" method="get">
        <input name="q" defaultValue={filters.q} placeholder="ID·관리업무항목명 검색" aria-label="검색어" />
        <select name="groupId" defaultValue={filters.groupId} aria-label="업무그룹"><option value="">전체 업무그룹</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}</select>
        <select name="band" defaultValue={filters.band} aria-label="상태"><option value="">전체 상태</option><option value="red">위험</option><option value="yellow">주의</option><option value="green">양호</option></select>
        <button className="button secondary" type="submit">조회</button>
        <Link className="button primary filter-primary-action" href="/management-tasks/new">+ 신규 등록</Link>
      </form>
      <section className="panel compact">{result.tasks.length ? <ManagementTaskTable tasks={result.tasks} /> : <div className="empty">조건에 맞는 관리업무항목이 없습니다.</div>}</section>
      {result.totalPages > 1 && <nav className="pagination" aria-label="페이지 이동">
        {result.page > 1 ? <Link href={`/management-tasks?${queryString(filters, { page: result.page - 1 })}`}>이전</Link> : <span />}
        <strong>{result.page} / {result.totalPages}</strong>
        {result.page < result.totalPages ? <Link href={`/management-tasks?${queryString(filters, { page: result.page + 1 })}`}>다음</Link> : <span />}
      </nav>}
    </div>
  </>;
}
