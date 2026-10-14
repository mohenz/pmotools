import Link from "next/link";
import { MP_TOP_LEVEL_WRITE_MESSAGE } from "@/lib/server/mp/context";

// 최상위 프로젝트 선택 상태에서 등록·엑셀 업로드 화면 대신 보여준다(2026-09-30 결정) — 상단 대상 프로젝트 선택 상자에서 하위 프로젝트로 바꾸면 다시 열린다.
export function MpTopLevelBlocked({ title, listHref, listLabel }: { title: string; listHref: string; listLabel: string }) {
  return <>
    <header className="topbar"><div><h1>{title}</h1><p>최상위 프로젝트 통합 조회 중</p></div><Link className="button secondary" href={listHref}>{listLabel}</Link></header>
    <div className="content"><section className="panel"><p className="empty" role="status">{MP_TOP_LEVEL_WRITE_MESSAGE}</p></section></div>
  </>;
}
