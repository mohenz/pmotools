import Link from "next/link";
import { notFound } from "next/navigation";
import { getMpScope } from "@/lib/server/mp/context";
import { getDefectCodes } from "@/lib/server/mp/defects/common";
import { getDefect } from "@/lib/server/mp/defects/defects";
import { listProjectMembers } from "@/lib/server/mp/defects/lookup";
import { DomainError } from "@/lib/server/errors";
import { DefectDetail } from "@/features/mp/defects/DefectDetail";

export const dynamic = "force-dynamic";

// DM-03 결함 상세·조치·이력 — 볼 수 없는 결함은 존재 여부를 알려 주지 않고 "없음"으로 처리한다.
export default async function DefectDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const scope = await getMpScope();
  if (scope.isTopLevel) return <div className="content"><p className="action-message">하위 프로젝트를 선택해 주세요.</p></div>;
  const c = scope.context;
  const actor = { projectId: c.projectId, userId: c.userId, role: c.role, jobTitle: c.jobTitle };
  const defect = await getDefect(actor, id).catch((e) => { if (e instanceof DomainError && e.code === "NOT_FOUND") return null; throw e; });
  if (!defect) notFound();
  const [codes, members] = await Promise.all([getDefectCodes(c.projectId), defect.permissions.assign ? listProjectMembers(c.projectId) : Promise.resolve([])]);
  return <>
    <header className="topbar"><div><h1>{defect.displayId}</h1><p>{defect.title}</p></div><div className="topbar-actions"><Link className="button secondary" href="/mp-defects">목록</Link></div></header>
    <div className="content ut-edit">
      {sp.notice === "evidence" && <p className="action-message" role="status">결함은 등록되었지만 증적 파일을 저장하지 못했습니다. 아래에서 다시 올려 주세요.</p>}
      <DefectDetail defect={defect} codes={codes} members={members} />
    </div>
  </>;
}
