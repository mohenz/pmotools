import Link from "next/link";
import { workLogStatusLabel } from "@/lib/domain/work-logs";
import type { WorkLogDetail } from "@/lib/server/work-logs";
import { WorkLogDetailActions } from "@/features/work/WorkLogDetailActions";

function dateTime(value: string) { return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value)); }

export function WorkLogDetailScreen({ detail, backHref = "/work-logs" }: { detail: WorkLogDetail; backHref?: string }) {
  return <><header className="topbar"><div><p className="mono">{detail.displayId}</p><h1>업무일지 조회</h1></div></header><div className="content detail-layout"><section className="detail-main"><article className="panel detail-summary"><div className="detail-badges"><span className={`badge ${detail.status === "COMPLETED" ? "band-green" : "band-yellow"}`}>{workLogStatusLabel(detail.status)}</span><span className="badge">{detail.groupLabel}</span></div><div className="table-wrap"><table className="management-task-summary-table work-log-detail-table"><tbody>
    <tr><th scope="row">번호</th><td className="mono">{detail.displayId}</td></tr><tr><th scope="row">업무일자</th><td>{detail.workDate}</td></tr><tr><th scope="row">업무그룹</th><td>{detail.groupLabel}</td></tr><tr><th scope="row">담당자</th><td>{detail.assigneeName} ({detail.assigneeUserId})</td></tr><tr><th scope="row">WBS번호</th><td className="mono">{detail.wbsNumber ? (detail.wbsItemId ? <Link className="table-link" href={`/wbs/${detail.wbsItemId}`}>{detail.wbsNumber}</Link> : detail.wbsNumber) : "-"}</td></tr><tr><th scope="row">진행상태</th><td>{workLogStatusLabel(detail.status)}</td></tr><tr><th scope="row">업무내용</th><td className="prewrap">{detail.workContent}</td></tr><tr><th scope="row">참고내용</th><td className="prewrap">{detail.referenceContent || "-"}</td></tr><tr><th scope="row">비고</th><td className="prewrap">{detail.notes || "-"}</td></tr><tr><th scope="row">등록일시</th><td>{dateTime(detail.createdAt)}</td></tr><tr><th scope="row">최종수정</th><td>{dateTime(detail.updatedAt)}</td></tr>
  </tbody></table></div></article><WorkLogDetailActions id={detail.id} version={detail.version} backHref={backHref} editable={detail.editable} deletable={detail.deletable} /></section></div></>;
}
