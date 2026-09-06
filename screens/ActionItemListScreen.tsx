import Link from "next/link";
import { ACTION_ITEM_STATUSES } from "@/lib/domain/action-items";
import type { CommonCode } from "@/lib/server/common-codes";
import type { ProjectActionItemFilters, ProjectActionItemRow } from "@/lib/server/action-items";
import type { ProjectMemberOption } from "@/lib/server/users";

type Filters = Required<Pick<ProjectActionItemFilters, "q" | "status" | "groupId" | "assigneeId" | "page">>;
type Result = { rows: ProjectActionItemRow[]; total: number; page: number; pageSize: number; totalPages: number };

function queryString(filters: Filters, overrides: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...overrides }).forEach(([key, value]) => {
    if (value !== "" && value != null && !(key === "page" && value === 1)) params.set(key, String(value));
  });
  return params.toString();
}

export function ActionItemListScreen({ result, filters, groups, members }: { result: Result; filters: Filters; groups: CommonCode[]; members: ProjectMemberOption[] }) {
  return <>
    <header className="topbar"><div><h1>액션아이템목록조회</h1><p>총 {result.total}건 · 프로젝트 전체 집중관리업무의 액션아이템 (PM/PMO 전용)</p></div></header>
    <div className="content">
      <form className="filters" method="get">
        <input name="q" defaultValue={filters.q} placeholder="액션아이템명·비고 검색" aria-label="검색어" />
        <select name="status" defaultValue={filters.status} aria-label="상태"><option value="">전체 상태</option>{ACTION_ITEM_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
        <select name="groupId" defaultValue={filters.groupId} aria-label="업무그룹"><option value="">전체 업무그룹</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}</select>
        <select name="assigneeId" defaultValue={filters.assigneeId} aria-label="담당자"><option value="">전체 담당자</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
        <button className="button secondary" type="submit">조회</button>
      </form>
      <section className="panel compact">
        {result.rows.length ? <div className="table-wrap"><table className="action-item-table"><thead><tr>
          <th>집중관리업무</th><th>세부항목</th><th>구분</th><th>액션아이템명</th><th>업무그룹</th><th>담당자</th><th>기한</th><th>상태</th>
        </tr></thead><tbody>
          {result.rows.map((row) => <tr key={row.id}>
            <td><Link href={`/management-tasks/${row.taskId}`}>{row.taskDisplayId} <small>{row.taskName}</small></Link></td>
            <td>{row.axisLabel}</td><td>{row.categoryLabel ?? "-"}</td><td>{row.name}</td>
            <td>{row.groupLabel}</td><td>{row.assigneeName}</td><td>{row.dueDate ?? "-"}</td>
            <td>{ACTION_ITEM_STATUSES.find((status) => status.value === row.status)?.label}</td>
          </tr>)}
        </tbody></table></div> : <div className="empty">조건에 맞는 액션아이템이 없습니다.</div>}
      </section>
      {result.totalPages > 1 && <nav className="pagination" aria-label="페이지 이동">
        {result.page > 1 ? <Link href={`/action-items?${queryString(filters, { page: result.page - 1 })}`}>이전</Link> : <span />}
        <strong>{result.page} / {result.totalPages}</strong>
        {result.page < result.totalPages ? <Link href={`/action-items?${queryString(filters, { page: result.page + 1 })}`}>다음</Link> : <span />}
      </nav>}
    </div>
  </>;
}
