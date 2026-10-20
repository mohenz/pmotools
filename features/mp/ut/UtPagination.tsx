import Link from "next/link";

// 표준 페이징(요구사항관리2 목록과 같은 구성) — 표시 개수(20~100·전체) + 페이지 번호 10개 + 총 건수.
export const UT_PAGE_SIZES = [20, 40, 60, 80, 100] as const;
export type UtPageSize = number | "all";

export function parsePaging(params: Record<string, string | string[] | undefined>) {
  const size = params.pageSize === "all" ? "all" as const : typeof params.pageSize === "string" && (UT_PAGE_SIZES as readonly number[]).includes(Number(params.pageSize)) ? Number(params.pageSize) : 20;
  const page = typeof params.page === "string" ? Math.max(1, Number(params.page) || 1) : 1;
  return { pageSize: size as UtPageSize, page };
}

export function paginate<T>(rows: T[], page: number, pageSize: UtPageSize) {
  const size = pageSize === "all" ? Math.max(rows.length, 1) : pageSize;
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, totalPages);
  return { rows: rows.slice((current - 1) * size, current * size), total: rows.length, page: current, totalPages };
}

function queryString(filters: Record<string, string>, pageSize: UtPageSize, page: number) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  if (pageSize !== 20) params.set("pageSize", String(pageSize));
  if (page !== 1) params.set("page", String(page));
  return params.toString();
}

export function UtPagination({ basePath, filters, pageSize, page, total, totalPages }: { basePath: string; filters: Record<string, string>; pageSize: UtPageSize; page: number; total: number; totalPages: number }) {
  if (total === 0) return null;
  const count = Math.min(10, totalPages);
  const first = Math.max(1, Math.min(page - 4, totalPages - count + 1));
  const pages = Array.from({ length: count }, (_, i) => first + i);
  const href = (p: number) => `${basePath}?${queryString(filters, pageSize, p)}`;
  return <nav className="pagination requirement-pagination" aria-label="페이지 이동">
    <form className="page-size-form" method="get" action={basePath}>
      {Object.entries(filters).filter(([, v]) => v).map(([k, v]) => <input type="hidden" name={k} value={v} key={k} />)}
      <label>표시 개수<select name="pageSize" defaultValue={String(pageSize)}>{UT_PAGE_SIZES.map((n) => <option value={n} key={n}>{n}개</option>)}<option value="all">전체</option></select></label>
      <button className="button secondary" type="submit">적용</button>
    </form>
    <div className="page-links">
      {page > 1 && <Link href={href(page - 1)} aria-label="이전 페이지">이전</Link>}
      {pages.map((p) => p === page ? <strong className="current" aria-current="page" key={p}>{p}</strong> : <Link href={href(p)} key={p}>{p}</Link>)}
      {page < totalPages && <Link href={href(page + 1)} aria-label="다음 페이지">다음</Link>}
    </div>
    <span className="page-summary">총 {total}건 · {page} / {totalPages} 페이지</span>
  </nav>;
}
