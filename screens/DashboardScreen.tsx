import Link from "next/link";
import { probabilityLabel, statusLabels } from "@/lib/domain/items";
import type { ItemRow } from "@/lib/server/items";

type DashboardData = {
  summary: { total: number; openIssues: number; openRisks: number; stale: number };
  matrix: { probability: string; impact: string; count: number }[];
  categories: { category: string; label: string; count: number }[];
  staleItems: ItemRow[];
};

const levels = ["high", "medium", "low"];

export function DashboardScreen({ data }: { data: DashboardData }) {
  const matrix = new Map(data.matrix.map((cell) => [`${cell.probability}:${cell.impact}`, cell.count]));
  const maxCategory = Math.max(1, ...data.categories.map((item) => item.count));

  return (
    <>
      <header className="topbar">
        <div><h1>통제 대시보드</h1><p>프로젝트 이슈·리스크 현황</p></div>
        <div className="topbar-actions"><Link className="button secondary" href="/items">전체 목록</Link><Link className="button primary" href="/items/new">+ 신규 등록</Link></div>
      </header>
      <div className="content">
        <section className="kpi-grid" aria-label="핵심 지표">
          <Kpi href="/items" label="전체 등록 건수" value={data.summary.total} note="이슈+리스크 누적" />
          <Kpi href="/items?kind=issue&open=true" label="미해결 이슈" value={data.summary.openIssues} note="등록/진행중" />
          <Kpi href="/items?kind=risk&open=true" label="미해결 리스크" value={data.summary.openRisks} note="등록/진행중" />
          <Kpi href="/items?stale=true" label="3영업일 이상 정체" value={data.summary.stale} note="에스컬레이션 대상" critical={data.summary.stale > 0} />
        </section>

        <section className="panel">
          <div className="panel-head"><h2>리스크 매트릭스</h2><span>확률 × 영향</span></div>
          <div className="matrix-layout">
            <div className="matrix" aria-label="리스크 매트릭스">
              <div />
              {levels.map((impact) => <div className="axis" key={`head-${impact}`}>영향 {probabilityLabel(impact)}</div>)}
              {levels.map((probability) => [
                <div className="axis" key={`axis-${probability}`}>확률 {probabilityLabel(probability)}</div>,
                ...levels.map((impact) => {
                  const count = matrix.get(`${probability}:${impact}`) ?? 0;
                  return <Link aria-label={`확률 ${probabilityLabel(probability)}, 영향 ${probabilityLabel(impact)} 목록 ${count}건`} href={`/items?probability=${probability}&impact=${impact}&open=true`} className={`matrix-cell heat-${Math.min(count, 4)}`} key={`${probability}-${impact}`}><strong>{count}</strong><span>건</span></Link>;
                }),
              ])}
            </div>
            <p className="matrix-note">이슈는 발생 확률을 ‘상’으로 고정합니다. 확률과 영향 점수가 높을수록 에스컬레이션 레벨이 상향됩니다.</p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>유형별 미해결 현황</h2><span>6개 관리 유형</span></div>
          <div className="category-list">
            {data.categories.map((category) => {
              return <Link href={`/items?category=${category.category}&open=true`} className="category-row" key={category.category}><span>{category.label}</span><div><i style={{ width: `${category.count / maxCategory * 100}%` }} /></div><strong>{category.count}</strong></Link>;
            })}
          </div>
        </section>

        {data.staleItems.length > 0 && <section className="panel">
          <div className="panel-head"><h2>에스컬레이션 대상</h2><span>3영업일 이상 미해결</span></div>
          <ItemTable items={data.staleItems} />
        </section>}
      </div>
    </>
  );
}

function Kpi({ href, label, value, note, critical = false }: { href: string; label: string; value: number; note: string; critical?: boolean }) {
  return <Link href={href} className="kpi"><span>{label}</span><strong className={critical ? "critical" : ""}>{value}</strong><small>{note} · 목록 보기</small></Link>;
}

export function ItemTable({ items }: { items: ItemRow[] }) {
  return <div className="table-wrap"><table><thead><tr><th>ID</th><th>구분</th><th>유형</th><th>제목</th><th>Track</th><th>확률/영향</th><th>레벨</th><th>상태</th><th>최종갱신</th></tr></thead>
    <tbody>{items.map((item) => <tr className={item.probability === "high" && item.impact === "high" ? "high-risk-row" : ""} key={item.id}>
      <td className="mono"><Link className="table-link" href={`/items/${item.id}`}>{item.displayId}</Link></td><td><span className={`badge ${item.kind}`}>{item.kind === "issue" ? "이슈" : "리스크"}</span></td>
      <td>{item.categoryLabel}</td><td className="title-cell"><Link className="table-link" href={`/items/${item.id}`}>{item.title}</Link></td><td>{item.trackName}</td>
      <td className="mono">{probabilityLabel(item.probability)} / {probabilityLabel(item.impact)}</td>
      <td>{item.escalationLabel}</td><td>{statusLabels[item.status]}</td>
      <td>{item.isStale && <i className="stale-dot" />}{item.businessDaysIdle}영업일 전</td>
    </tr>)}</tbody></table></div>;
}
