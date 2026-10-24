import Link from "next/link";
import { getMpScope } from "@/lib/server/mp/context";
import { listUnassignedDefects } from "@/lib/server/mp/defects/defects";
import { listProjectMembers } from "@/lib/server/mp/defects/lookup";
import { UtPagination, paginate, parsePaging } from "@/features/mp/ut/UtPagination";
import { fmtDate } from "@/features/mp/defects/format";
import { AssignInline } from "@/features/mp/defects/AssignInline";

export const dynamic = "force-dynamic";

// DM-04 미배정 결함 — 내가 조치자를 지정할 수 있는 결함만 보여 준다.
export default async function UnassignedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const scope = await getMpScope();
  if (scope.isTopLevel) return <div className="content"><p className="action-message">하위 프로젝트를 선택해 주세요.</p></div>;
  const c = scope.context;
  const [result, members] = await Promise.all([listUnassignedDefects({ projectId: c.projectId, userId: c.userId, role: c.role, jobTitle: c.jobTitle }), listProjectMembers(c.projectId)]);
  const { page, pageSize } = parsePaging(params);
  const paged = paginate(result.rows, page, pageSize);
  return <>
    <header className="topbar"><div><h1>미배정 결함</h1><p>조치자가 없는 결함 {result.totalCount}건 · 지정 권한이 있는 결함만 표시됩니다</p></div></header>
    <div className="content"><section className="panel compact">
      {paged.rows.length ? <div className="table-wrap"><table className="ut-table">
        <thead><tr><th>결함번호</th><th>제목</th><th>단계</th><th>심각도</th><th>등록자</th><th>등록일</th><th>조치자 지정</th></tr></thead>
        <tbody>{paged.rows.map((r) => <tr key={r.id}>
          <td className="mono"><Link className="table-link" href={`/mp-defects/${r.id}`}>{r.displayId}</Link></td><td className="title-cell">{r.title}</td><td>{r.testStage}</td><td>{r.severity}</td><td>{r.creator}</td><td>{fmtDate(r.createdAt)}</td>
          <td><AssignInline defectId={r.id} members={members} /></td>
        </tr>)}</tbody>
      </table></div> : <div className="empty">미배정 결함이 없습니다.</div>}
    </section>
      <UtPagination basePath="/mp-defects/unassigned" filters={{}} pageSize={pageSize} page={paged.page} total={paged.total} totalPages={paged.totalPages} />
    </div>
  </>;
}
