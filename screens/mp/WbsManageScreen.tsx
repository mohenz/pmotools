// [WBS2 복사본] 원본: screens/WbsManageScreen.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import Link from "next/link";
import { WbsDataManagementPanel } from "@/features/mp/wbs/WbsDataManagementPanel";

export function WbsManageScreen() {
  return <>
    <header className="topbar"><div><h1>WBS 데이터 관리</h1><p>엑셀 업로드/다운로드, 데이터 초기화</p></div></header>
    <div className="content">
      <WbsDataManagementPanel>
        <section className="panel compact">
          <div className="panel-head"><h2>관리 도구</h2></div>
          <div className="wbs-inline-form">
            <label>담당자 동명이인 정리<Link className="button secondary" href="/mp-wbs/owner-conflicts">동명이인 정리로 이동</Link></label>
          </div>
        </section>
      </WbsDataManagementPanel>
    </div>
  </>;
}
