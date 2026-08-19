import Link from "next/link";
import { notFound } from "next/navigation";
import { getManual } from "@/lib/domain/manuals";
import { getLocalContext } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export default async function ManualDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  await getLocalContext();
  const manual = getManual((await params).slug);
  if (!manual) notFound();
  return <><header className="topbar"><div><h1>{manual.title} 매뉴얼</h1><p>{manual.description}</p></div><div className="topbar-actions"><Link className="button secondary" href="/manuals">목록</Link><a className="button primary" href={manual.file} target="_blank" rel="noreferrer">새 창에서 열기</a></div></header><div className="content manual-content"><section className="panel manual-viewer"><iframe src={manual.file} title={`${manual.title} 매뉴얼`} /></section></div></>;
}
