import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdminContext } from "@/lib/server/context";
import { getPrisma } from "@/lib/server/db-pg";
import { getProjectInformation } from "@/lib/server/project-information";
import { ProjectInformationForm } from "@/features/project/ProjectInformationForm";
import { ProjectMembersPanel } from "@/features/project/ProjectMembersPanel";
import { listAssignableUsers, listProjectAssignees } from "@/lib/server/projects-admin";
import { NUMBERED_SEQUENCES, firstNumberOf } from "@/lib/domain/numbering";

export const dynamic = "force-dynamic";

// 플랫폼 관리 → 프로젝트 관리 → 프로젝트 정보 수정 — 로그인 프로젝트와 무관하게 선택한 프로젝트의 정보를 수정한다.
export default async function PlatformProjectEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireSuperAdminContext();
  const { id } = await params;
  const row = await getPrisma().project.findUnique({ where: { id }, select: { id: true, numberingBase: true, parent: { select: { code: true, name: true } } } });
  if (!row) notFound();
  const [project, members, candidates] = await Promise.all([getProjectInformation(id), listProjectAssignees(userId, id), listAssignableUsers(userId, id)]);
  return <>
    <header className="topbar"><div><h1>프로젝트 정보 · {project.name}</h1><p>{project.code}{row.parent ? ` · 상위 ${row.parent.name} (${row.parent.code})` : " · 최상위(대표) 프로젝트"}</p></div>
      <div className="topbar-actions"><Link className="button secondary" href="/settings/projects">프로젝트 목록</Link></div>
    </header>
    <div className="content settings-content"><ProjectInformationForm project={project} endpoint={`/api/v1/admin/projects/${id}`} /><NumberingPanel base={row.numberingBase} /><ProjectMembersPanel projectId={id} members={members} candidates={candidates} /></div>
  </>;
}

// 번호 시작점(2026-09-30) — 프로젝트 생성 시 자동 발번, 읽기 전용. 전역 유일 표시 ID 7종이 이 번호 다음부터 발급된다.
function NumberingPanel({ base }: { base: number | null }) {
  const year = new Date().getFullYear();
  return <section className="panel" aria-label="번호 체계">
    <div className="panel-head"><div><h2>번호 체계</h2><p className="group-description">프로젝트 생성 시 시스템이 자동으로 정한 번호 시작점입니다. 다른 프로젝트와 번호가 겹치지 않도록 10만 단위로 나뉘며 수정할 수 없습니다.</p></div>
      <span className="mono">{base === null ? "미지정" : `시작점 ${firstNumberOf(base)}`}</span></div>
    {base === null
      ? <p className="form-error" role="alert">번호 시작점이 지정되지 않았습니다. 이 프로젝트에서 번호가 다른 프로젝트와 겹칠 수 있으니 시스템 관리자에게 확인을 요청해 주세요.</p>
      : <div className="table-wrap"><table><thead><tr><th>구분</th><th>첫 번호 예시</th></tr></thead><tbody>
        {NUMBERED_SEQUENCES.map((sequence) => <tr key={sequence.prefix}><td>{sequence.label}</td><td className="mono">{sequence.prefix === "ISU-" ? `ISU-${String(base + 1).padStart(4, "0")}` : sequence.prefix === "REQ-CHG-" ? `REQ-CHG-${year}-${firstNumberOf(base)}` : `${sequence.prefix}${year}-${firstNumberOf(base)}`}</td></tr>)}
      </tbody></table></div>}
  </section>;
}
