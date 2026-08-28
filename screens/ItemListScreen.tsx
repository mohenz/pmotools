import Link from "next/link";
import { impacts, probabilities } from "@/lib/domain/items";
import type { CommonCode } from "@/lib/server/common-codes";
import type { ItemFilters, ItemRow } from "@/lib/server/items";
import { ItemTable } from "./DashboardScreen";

type Filters = Required<Pick<ItemFilters, "q" | "kind" | "status" | "category" | "probability" | "impact" | "open" | "stale" | "page">>;
type Result = { items: ItemRow[]; total: number; page: number; pageSize: number; totalPages: number };

function queryString(filters: Filters, overrides: Record<string, string | number | boolean | undefined> = {}) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...overrides }).forEach(([key, value]) => {
    if (value !== "" && value !== false && value != null && !(key === "page" && value === 1)) params.set(key, String(value));
  });
  return params.toString();
}

export function ItemListScreen({ result, filters, options }: { result: Result; filters: Filters; options: { categories: CommonCode[] } }) {
  const exportQuery = queryString(filters, { page: undefined });
  return <>
    <header className="topbar"><div><h1>전체 목록</h1><p>총 {result.total}건 · 서버 검색 및 필터</p></div><div className="topbar-actions"><a className="button secondary" href={`/api/v1/items/export${exportQuery ? `?${exportQuery}` : ""}`}>CSV 내보내기</a></div></header>
    <div className="content">
      {(filters.open || filters.stale || filters.probability || filters.impact || filters.category) && <div className="active-filter"><span>대시보드 조건이 적용되었습니다.</span><Link href="/items">전체 조건 해제</Link></div>}
      <form className="filters" method="get">
        <input name="q" defaultValue={filters.q} placeholder="제목·내용·담당자 검색" aria-label="검색어" />
        <select name="kind" defaultValue={filters.kind} aria-label="구분"><option value="">전체 구분</option><option value="issue">이슈</option><option value="risk">리스크</option></select>
        <select name="category" defaultValue={filters.category} aria-label="유형"><option value="">전체 유형</option>{options.categories.map((item) => <option key={item.id} value={item.code}>{item.label}</option>)}</select>
        <select name="status" defaultValue={filters.status} aria-label="상태"><option value="">전체 상태</option><option value="registered">등록</option><option value="in_progress">진행중</option><option value="resolved">해결</option><option value="on_hold">보류</option></select>
        <select name="probability" defaultValue={filters.probability} aria-label="확률"><option value="">전체 확률</option>{probabilities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <select name="impact" defaultValue={filters.impact} aria-label="영향"><option value="">전체 영향</option>{impacts.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        {filters.open && <input type="hidden" name="open" value="true" />}{filters.stale && <input type="hidden" name="stale" value="true" />}
        <button className="button secondary" type="submit">조회</button>
        <Link className="button primary filter-primary-action" href="/items/new">+ 신규 등록</Link>
      </form>
      <section className="panel compact">{result.items.length ? <ItemTable items={result.items} /> : <div className="empty">조건에 맞는 이슈·리스크가 없습니다.</div>}</section>
      {result.totalPages > 1 && <nav className="pagination" aria-label="페이지 이동">
        {result.page > 1 ? <Link href={`/items?${queryString(filters, { page: result.page - 1 })}`}>이전</Link> : <span />}
        <strong>{result.page} / {result.totalPages}</strong>
        {result.page < result.totalPages ? <Link href={`/items?${queryString(filters, { page: result.page + 1 })}`}>다음</Link> : <span />}
      </nav>}
    </div>
  </>;
}
