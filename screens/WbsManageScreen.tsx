import Link from "next/link";
import { WbsDataManagementPanel } from "@/features/wbs/WbsDataManagementPanel";

export function WbsManageScreen() {
  return <>
    <header className="topbar"><div><h1>WBS 데이터 관리</h1><p>엑셀 업로드/다운로드, 데이터 초기화</p></div></header>
    <div className="content">
      <section className="panel compact">
        <div className="panel-head"><h2>관리 도구</h2></div>
        <div className="wbs-inline-form">
          <label>담당자 동명이인 정리<Link className="button secondary" href="/wbs/owner-conflicts">동명이인 정리로 이동</Link></label>
        </div>
      </section>
      <WbsDataManagementPanel />
    </div>
  </>;
}
