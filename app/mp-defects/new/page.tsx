import { getMpScope } from "@/lib/server/mp/context";
import { ensureDefectCommonCodes, getDefectCodes } from "@/lib/server/mp/defects/common";
import { getCaseEntry, listProjectMembers } from "@/lib/server/mp/defects/lookup";
import { listScreens } from "@/lib/server/mp/defects/screens";
import { listActiveOrigins } from "@/lib/server/mp/defects/settings";
import { loadAccessFacts } from "@/lib/server/mp/defects/defects";
import { canAssignDefect } from "@/lib/domain/defect-access";
import { DefectForm } from "@/features/mp/defects/DefectForm";

export const dynamic = "force-dynamic";

// DM-02 결함 등록 — 수동 등록, 단위테스트 케이스 id(?case=) 진입, 위젯·확장 프로그램 진입(?popup=1)을 한 화면에서 처리한다.
export default async function DefectNewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const scope = await getMpScope();
  if (scope.isTopLevel) return <div className="content ut-edit"><p className="action-message">결함관리는 하위 프로젝트 단위로 관리합니다. 상단에서 하위 프로젝트를 선택해 주세요.</p></div>;
  const c = scope.context;
  const actor = { projectId: c.projectId, userId: c.userId, role: c.role, jobTitle: c.jobTitle };
  await ensureDefectCommonCodes(c.projectId);
  const [codes, screens, origins, facts] = await Promise.all([getDefectCodes(c.projectId), listScreens(actor), listActiveOrigins(c.projectId), loadAccessFacts(actor)]);
  const entry = params.case ? await getCaseEntry(c.projectId, params.case).catch(() => null) : null; // 서버가 id로 읽기 전용 해석 — 표시값은 클라이언트를 믿지 않는다
  const canAssign = canAssignDefect({ userId: c.userId, role: c.role, jobTitle: c.jobTitle }, { groupId: entry?.groupId ?? null, caseId: entry?.id ?? null }, facts);
  const members = canAssign ? await listProjectMembers(c.projectId) : [];
  const isPopup = params.popup === "1";
  return <>
    <header className={`topbar ${isPopup ? "popup-header" : ""}`}>
      <div>
        <h1>결함 등록</h1>
        <p>{isPopup ? "수집된 화면 및 결함 정보가 자동으로 반영됩니다. 내용을 확인하고 등록해 주세요." : "케이스 없이도 등록할 수 있습니다. 단위테스트 케이스는 검색해서 연결할 수 있습니다."}</p>
      </div>
    </header>
    <div className={`content ut-edit ${isPopup ? "popup-content" : ""}`}>
      <DefectForm codes={codes} screens={screens.rows.map((s) => ({ path: s.path, name: s.name }))} allowedOrigins={origins} members={members} canAssign={canAssign} popup={isPopup}
        initial={{ caseEntry: entry, stageId: params.stage ?? "", title: params.title ?? "" }} />
    </div>
  </>;
}
