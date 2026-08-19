import Link from "next/link";
import { getLocalContext } from "@/lib/server/context";
import { MANUALS } from "@/lib/domain/manuals";

export const dynamic = "force-dynamic";

export default async function ManualsPage() {
  await getLocalContext();
  return <><header className="topbar"><div><h1>매뉴얼</h1><p>PMOTOOLS 주요 기능의 관리자·사용자 안내서입니다.</p></div></header><div className="content manual-content"><section className="manual-card-grid">
    {MANUALS.map((manual, index) => <Link className="panel manual-card" href={`/manuals/${manual.slug}`} key={manual.slug}><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{manual.title}</h2><p>{manual.description}</p></div><strong>매뉴얼 보기 →</strong></Link>)}
  </section></div></>;
}
