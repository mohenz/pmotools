import Link from "next/link";
import { getLocalContext } from "@/lib/server/context";
import { MANUALS } from "@/lib/domain/manuals";

export const dynamic = "force-dynamic";

export default async function ManualsPage() {
  await getLocalContext();
  return <><header className="topbar"><div><h1>매뉴얼</h1><p>PMOTOOLS 주요 기능의 관리자·사용자 안내서입니다.</p></div></header><div className="content manual-content"><section className="panel manual-list-panel">
    <div className="panel-head"><h2>기능별 매뉴얼</h2><span>{MANUALS.length}개</span></div>
    <div className="manual-list">{MANUALS.map((manual, index) => <Link className="manual-list-row" href={`/manuals/${manual.slug}`} key={manual.slug}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{manual.title}</strong><p>{manual.description}</p></div><b>보기 →</b></Link>)}</div>
  </section></div></>;
}
