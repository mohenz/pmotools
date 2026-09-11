import Link from "next/link";
import type { CommonCode } from "@/lib/server/common-codes";
import type { ProjectMemberOption } from "@/lib/server/users";
import type { WbsExcelRow, WbsItemDetail, WbsItemRow } from "@/lib/server/wbs";
import { WbsDetailActions } from "@/features/wbs/WbsDetailActions";

export function WbsEditScreen({ detail, items, groups, members, excelRow }: { detail: NonNullable<WbsItemDetail>; items: WbsItemRow[]; groups: CommonCode[]; members: ProjectMemberOption[]; excelRow: WbsExcelRow | null }) {
  const { item, assignments, deliverable } = detail;
  return <>
    <header className="topbar">
      <div><p className="mono">{item.displayId} · {item.code}</p><h1>{item.name} 수정</h1></div>
      <div className="topbar-actions"><Link className="button secondary" href={`/wbs/${item.id}`}>조회 화면으로</Link><Link className="button secondary" href="/wbs">목록으로</Link></div>
    </header>
    <div className="content"><section className="detail-main wbs-detail-main">
      <WbsDetailActions item={item} items={items} groups={groups} members={members} assignments={assignments} deliverable={deliverable} excelRow={excelRow} />
    </section></div>
  </>;
}
