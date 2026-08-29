import { WbsDataManagementPanel } from "@/features/wbs/WbsDataManagementPanel";

export function WbsManageScreen() {
  return <>
    <header className="topbar"><div><h1>WBS 데이터 관리</h1><p>엑셀 업로드/다운로드, 데이터 초기화</p></div></header>
    <div className="content">
      <WbsDataManagementPanel />
    </div>
  </>;
}
