import Link from "next/link";
import { probabilityLabel, statusLabels } from "@/lib/domain/items";
import type { CommonCode } from "@/lib/server/common-codes";
import type { ItemEventRow, ItemRow } from "@/lib/server/items";
import { ItemDetailActions } from "@/features/items/ItemDetailActions";

const eventLabels: Record<ItemEventRow["eventType"], string> = {
  created: "등록", comment: "코멘트", status_changed: "상태 변경", level_changed: "레벨 변경", edited: "정보 수정", archived: "보관",
};

export function ItemDetailScreen({ detail, options }: { detail: { item: ItemRow; events: ItemEventRow[] }; options: { categories: CommonCode[]; tracks: CommonCode[]; escalations: CommonCode[] } }) {
  const { item, events } = detail;
  return <>
    <header className="topbar"><div><p className="mono">{item.displayId}</p><h1>{item.title}</h1></div><div className="topbar-actions"><Link className="button secondary" href="/items">목록으로</Link><Link className="button primary" href="/items/new">+ 신규 등록</Link></div></header>
    <div className="content detail-layout">
      <section className="detail-main">
        <article className="panel detail-summary">
          <div className="detail-badges"><span className={`badge ${item.kind}`}>{item.kind === "issue" ? "이슈" : "리스크"}</span><span className="badge">{item.categoryLabel}</span><span className="badge">{item.trackName}</span><span className="badge">{item.escalationLabel}</span>{item.isStale && <span className="badge level-c_level">에스컬레이션 대상</span>}</div>
          <dl><div><dt>상세 내용</dt><dd className="prewrap">{item.description || "-"}</dd></div><div><dt>확률 / 영향</dt><dd>{probabilityLabel(item.probability)} / {probabilityLabel(item.impact)}</dd></div><div><dt>예상 손실/영향</dt><dd>{item.exposureText || "-"}</dd></div><div><dt>담당자</dt><dd>{item.ownerName || "-"}</dd></div><div><dt>등록일</dt><dd>{formatDate(item.createdAt)}</dd></div><div><dt>최종 갱신</dt><dd>{formatDate(item.updatedAt)} · {item.businessDaysIdle}영업일 전</dd></div></dl>
        </article>
        <ItemDetailActions item={item} options={options} />
      </section>
      <aside className="panel history-panel"><div className="panel-head"><h2>이력</h2><span>{events.length}건</span></div><div className="history-list">{events.length ? events.map((event) => <article className="history-item" key={event.id}><div><span className="badge">{eventLabels[event.eventType]}</span><time>{formatDate(event.createdAt)}</time></div><p>{eventDescription(event)}</p><small>{event.actorName}</small></article>) : <div className="empty">기록된 이력이 없습니다.</div>}</div></aside>
    </div>
  </>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(value));
}

function eventDescription(event: ItemEventRow) {
  const before = event.beforeData?.value;
  const after = event.afterData?.value;
  if (event.eventType === "status_changed" && typeof before === "string" && typeof after === "string") {
    return `${statusLabels[before as keyof typeof statusLabels] ?? before} → ${statusLabels[after as keyof typeof statusLabels] ?? after}`;
  }
  if (event.eventType === "level_changed" && typeof before === "string" && typeof after === "string") {
    return `${before} → ${after}`;
  }
  return event.body || "변경 기록";
}
