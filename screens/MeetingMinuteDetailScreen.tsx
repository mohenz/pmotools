import Link from "next/link";
import { MeetingMinuteDocument } from "@/features/meeting-minutes/MeetingMinuteDocument";
import { MeetingMinuteArchiveButton } from "@/features/meeting-minutes/MeetingMinuteArchiveButton";
import { MeetingActionStatusControl } from "@/features/meeting-minutes/MeetingActionStatusControl";
import { actionItemOverdueDays, todayInKorea } from "@/lib/domain/meeting-action-items";
import type { MeetingMinuteDetail } from "@/lib/server/meeting-minutes";

const dateTime = (value: string) => new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value));

export function MeetingMinuteDetailScreen({ minute }: { minute: MeetingMinuteDetail }) {
  return <>
    <header className="topbar"><div><h1>회의록</h1><p>{minute.displayId} · 등록 {minute.creatorName} · 최종 수정 {dateTime(minute.updatedAt)}</p></div>
      <div className="topbar-actions">
        <Link className="button secondary" href="/meeting-minutes">목록</Link>
        <Link className="button secondary" href={`/meeting-minutes/${minute.id}/print`}>인쇄·PDF</Link>
        {minute.canEdit && <Link className="button primary" href={`/meeting-minutes/${minute.id}/edit`}>수정</Link>}
        {minute.canEdit && <MeetingMinuteArchiveButton minuteId={minute.id} version={minute.version} />}
      </div>
    </header>
    <div className="content">
      <section className="panel minute-doc-panel"><MeetingMinuteDocument minute={minute} /></section>
      <ActionItemStatusPanel minute={minute} />
    </div>
  </>;
}

// 양식(인쇄본)은 원본 그대로 두고, 진행상태는 문서 아래 별도 표에서 관리한다 — 프로젝트 멤버 누구나 변경.
function ActionItemStatusPanel({ minute }: { minute: MeetingMinuteDetail }) {
  const items = minute.actionItems.filter((item) => item.id && item.status);
  if (!items.length) return null;
  const today = todayInKorea();
  return <section className="panel minute-action-panel" aria-label="Action Item 진행상태">
    <div className="panel-head"><h2>Action Item 진행상태</h2><span>{items.length}건 · <Link className="table-link" href={`/meeting-minutes/action-items?q=${encodeURIComponent(minute.displayId)}`}>모아보기에서 보기</Link></span></div>
    <div className="table-wrap"><table className="action-item-table"><thead><tr><th>No</th><th>Action Item</th><th>담당자</th><th>완료예정일</th><th>상태</th></tr></thead>
      <tbody>{items.map((item, index) => {
        const overdue = actionItemOverdueDays({ status: item.status!, dueDate: item.dueDate || null }, today);
        return <tr key={item.id} className={overdue ? "action-overdue" : undefined}>
          <td data-numeric>{index + 1}</td><td className="title-cell">{item.title || item.content || "-"}</td><td>{item.assigneeName || "-"}</td>
          <td className="mono">{item.dueDate ? item.dueDate.replaceAll("-", ".") : "-"}{overdue > 0 && <span className="badge band-red pmo-dash-tag">기한 경과 {overdue}일</span>}</td>
          <td><MeetingActionStatusControl id={item.id!} title={item.title || item.content || minute.title} status={item.status!} /></td>
        </tr>;
      })}</tbody></table></div>
  </section>;
}
