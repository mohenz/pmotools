import Link from "next/link";
import { getMpScope } from "@/lib/server/mp/context";
import { ensureDefectCommonCodes, getDefectCodes } from "@/lib/server/mp/defects/common";
import { listDefects } from "@/lib/server/mp/defects/defects";
import { UtPagination, parsePaging } from "@/features/mp/ut/UtPagination";
import { fmtDate } from "@/features/mp/defects/format";
import { STATUS_CLASS_BADGE, STATUS_CLASS_LABEL } from "@/features/mp/defects/client";

export const dynamic = "force-dynamic";

// DM-01 결함 목록 — 조회 범위는 서버가 적용한다(관리자·운영자·PMO는 전체, 그 외는 본인 관련 결함).
export default async function DefectListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const scope = await getMpScope();
  if (scope.isTopLevel) return <div className="content"><p className="action-message">결함관리는 하위 프로젝트 단위로 관리합니다. 상단에서 하위 프로젝트를 선택해 주세요.</p></div>;
  const c = scope.context;
  const actor = { projectId: c.projectId, userId: c.userId, role: c.role, jobTitle: c.jobTitle };
  await ensureDefectCommonCodes(c.projectId);
  const codes = await getDefectCodes(c.projectId);
  const filters = { q: pick("q"), stageId: pick("stageId"), statusClass: pick("statusClass"), severityId: pick("severityId"), assignee: pick("assignee"), from: pick("from"), to: pick("to") };
  const { page, pageSize } = parsePaging(params);
  const result = await listDefects(actor, { ...filters, unassigned: pick("assignee") === "none", assignee: pick("assignee") === "none" ? undefined : pick("assignee") || undefined, page, pageSize: pageSize === "all" ? 200 : pageSize });
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));
  const exportQuery = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  return <>
    <header className="topbar">
      <div><h1>결함 목록</h1><p>총 {result.totalCount}건 · 내 조회 범위 기준</p></div>
      <div className="topbar-actions">
        <a className="button secondary" href={`/api/v1/mp/defects/export?${exportQuery}`}>엑셀 출력</a>
        <Link className="button primary" href="/mp-defects/new">+ 결함 등록</Link>
      </div>
    </header>
    <div className="content">
      <form className="filters requirement-filter-panel" method="get">
        <input name="q" defaultValue={filters.q} placeholder="결함번호·제목 검색" aria-label="검색어" />
        <select name="stageId" defaultValue={filters.stageId} aria-label="테스트 단계"><option value="">전체 단계</option>{codes.stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        <select name="statusClass" defaultValue={filters.statusClass} aria-label="상태 분류"><option value="">전체 상태</option><option value="OPEN">미조치</option><option value="DONE">조치완료</option><option value="CLOSED">종결</option></select>
        <select name="severityId" defaultValue={filters.severityId} aria-label="심각도"><option value="">전체 심각도</option>{codes.severities.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        <select name="assignee" defaultValue={filters.assignee} aria-label="담당자"><option value="">전체 담당자</option><option value="me">내가 담당</option><option value="none">미배정</option></select>
        <input type="date" name="from" defaultValue={filters.from} aria-label="등록일 시작" /><input type="date" name="to" defaultValue={filters.to} aria-label="등록일 끝" />
        <button className="button secondary" type="submit">조회</button>
      </form>
      <section className="panel compact">
        {result.rows.length ? <div className="table-wrap"><table className="ut-table">
          <thead><tr><th>결함번호</th><th>제목</th><th>단계</th><th>심각도</th><th>상태</th><th>조치자</th><th>등록자</th><th>업무단위</th><th>등록일</th></tr></thead>
          <tbody>{result.rows.map((r) => <tr key={r.id}>
            <td className="mono"><Link className="table-link" href={`/mp-defects/${r.id}`}>{r.displayId}</Link></td>
            <td className="title-cell"><Link className="table-link" href={`/mp-defects/${r.id}`}>{r.title}</Link></td>
            <td>{r.testStage}</td><td>{r.severity}</td>
            <td><span className={`badge ${STATUS_CLASS_BADGE[r.statusClass]}`} title={STATUS_CLASS_LABEL[r.statusClass]}>{r.status}</span></td>
            <td>{r.assignee?.name ?? <span className="ut-hint">미배정</span>}</td><td>{r.creator}</td><td>{r.group ?? "–"}</td><td>{fmtDate(r.createdAt)}</td>
          </tr>)}</tbody>
        </table></div> : <div className="empty">조건에 맞는 결함이 없습니다.</div>}
      </section>
      <UtPagination basePath="/mp-defects" filters={filters} pageSize={pageSize} page={result.page} total={result.totalCount} totalPages={totalPages} />
    </div>
  </>;
}
