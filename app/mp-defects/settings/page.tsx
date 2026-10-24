import Link from "next/link";
import { getMpScope } from "@/lib/server/mp/context";
import { getDefectSettings } from "@/lib/server/mp/defects/settings";
import { listScreens } from "@/lib/server/mp/defects/screens";
import { DefectSettingsPanels } from "@/features/mp/defects/DefectSettingsPanels";

export const dynamic = "force-dynamic";

// DM-08 설정 · DM-10 대상 도메인 · DM-11 화면 목록. 변경은 운영자·PMO·관리자만 가능하고 나머지는 조회만 한다.
export default async function DefectSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const scope = await getMpScope();
  if (scope.isTopLevel) return <div className="content"><p className="action-message">하위 프로젝트를 선택해 주세요.</p></div>;
  const c = scope.context;
  const actor = { projectId: c.projectId, userId: c.userId, role: c.role, jobTitle: c.jobTitle };
  const tab = (["codes", "sites", "screens", "bench"] as const).find((t) => t === sp.tab) ?? "codes";
  const settings = await getDefectSettings(actor);
  const screens = tab === "screens" ? await listScreens(actor, sp.q ?? "", true) : { rows: [], canWrite: settings.canManage };
  const tabs = [["codes", "미조치 중대 결함 기준"], ["sites", "대상 도메인"], ["screens", "화면 목록"], ["bench", "테스트 벤치"]] as const;
  return <>
    <header className="topbar"><div><h1>결함관리 설정</h1><p>{settings.canManage ? "운영자·PMO·관리자는 변경할 수 있습니다." : "조회만 가능합니다. 변경은 운영자·PMO·관리자에게 요청해 주세요."}</p></div></header>
    <div className="content">
      <nav className="tool-tabs" aria-label="설정 구분">{tabs.map(([k, l]) => <Link key={k} className={tab === k ? "active" : ""} href={`/mp-defects/settings?tab=${k}`}>{l}</Link>)}</nav>
      <DefectSettingsPanels tab={tab} settings={settings} screens={screens.rows} q={sp.q ?? ""} />
    </div>
  </>;
}
