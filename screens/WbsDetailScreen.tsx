import Link from "next/link";
import { WBS_ITEM_STATUS_LABEL } from "@/lib/domain/wbs";
import type { WbsExcelRow, WbsItemDetail } from "@/lib/server/wbs";
import { WbsHistoryModal } from "@/features/wbs/WbsHistoryModal";

function percent(value: number | null) {
  return value === null ? "-" : `${Math.round(value * 100)}%`;
}

export function WbsDetailScreen({ detail, excelRow, viewer }: { detail: NonNullable<WbsItemDetail>; excelRow: WbsExcelRow | null; viewer: { userId: string; canViewAllWbs: boolean } }) {
  const { item, parent, children, assignments, deliverable, events } = detail;
  const canView = (ownerUserId: string | null) => viewer.canViewAllWbs || ownerUserId === viewer.userId;
  return <>
    <header className="topbar"><div><p className="mono">{item.displayId} · {item.code}</p><h1>{item.name}</h1></div></header>
    <div className="content">
      <section className="detail-main wbs-detail-main">
        <article className="panel compact detail-summary">
          <div className="detail-badges"><span className="badge">{WBS_ITEM_STATUS_LABEL[item.status]}</span>{item.groupLabel && <span className="badge">{item.groupLabel}</span>}{item.stage && <span className="badge">{item.stage}</span>}</div>
          <div className="panel-head"><h2>기본 정보</h2></div>
          <dl className="wbs-field-grid">
            <div><dt>wbs_level</dt><dd>{item.level}</dd></div>
            <div><dt>Project No.</dt><dd>{excelRow?.projectCode || "-"}</dd></div>
            <div><dt>Stage</dt><dd>{item.stage ?? "-"}</dd></div>
            <div><dt>Task</dt><dd className="mono">{item.code}</dd></div>
            <div><dt>Task Description</dt><dd>{item.name}</dd></div>
            <div><dt>트랜젝션코드(정렬SEQ)</dt><dd className="mono">{excelRow?.sequenceNo ?? "-"}</dd></div>
            <div><dt>상세진도</dt><dd>{excelRow?.isLeaf ? "대상" : "-"}</dd></div>
            <div><dt>상위 항목</dt><dd>{parent ? (canView(parent.ownerUserId) ? <Link className="table-link" href={`/wbs/${parent.id}`}>{parent.code} {parent.name}</Link> : `${parent.code} ${parent.name}`) : "(최상위 레벨)"}</dd></div>
            <div><dt>내용</dt><dd className="prewrap">{item.description || "-"}</dd></div>
          </dl>
        </article>

        <article className="panel compact detail-summary">
          <div className="panel-head"><h2>담당 · 일정</h2></div>
          <dl className="wbs-field-grid inline-fields">
            <div><dt>R&R(실행)</dt><dd>{item.ownerName ?? "-"}</dd></div>
            <div><dt>사용자ID</dt><dd>{item.ownerLoginId ?? "-"}</dd></div>
            <div><dt>R&R</dt><dd>{item.groupLabel ?? "-"}</dd></div>
            <div><dt>계획시작일</dt><dd>{item.startDate ?? "-"}</dd></div>
            <div><dt>계획종료일</dt><dd>{item.dueDate ?? "-"}</dd></div>
            <div><dt>실적시작일</dt><dd>{item.actualStartDate ?? "-"}</dd></div>
            <div><dt>실적종료일</dt><dd>{item.actualDueDate ?? "-"}</dd></div>
            <div><dt>Sort(Working Day)</dt><dd>{item.workingDays ?? "-"}</dd></div>
            <div><dt>세부진도</dt><dd>{Math.round(item.actualProgress * 100)}</dd></div>
          </dl>
        </article>

        <article className="panel compact detail-summary">
          <div className="panel-head"><h2>진척 현황</h2></div>
          <dl className="wbs-field-grid">
            <div><dt>목표(today)</dt><dd>{percent(item.plannedProgress)}</dd></div>
            <div><dt>실적</dt><dd>{percent(item.actualProgress)}</dd></div>
            <div><dt>진척율</dt><dd>{percent(item.progressIndex)}</dd></div>
            <div><dt>지연완료</dt><dd>{item.isDelayedCompletion ? 1 : 0}</dd></div>
            <div><dt>지연완료일자</dt><dd>{item.delayedCompletionDate ?? "-"}</dd></div>
            <div><dt>지연일자</dt><dd>{item.delayDays === null ? "-" : `${item.delayDays}일`}</dd></div>
          </dl>
        </article>

        <section className="panel compact">
          <div className="panel-head"><h2>역할별 진척등록권한·진도율</h2><span>{assignments.filter((a) => a.hasPermission).length}/{assignments.length}개 Track</span></div>
          {assignments.length ? <div className="table-wrap"><table>
            <thead><tr><th>구분</th>{assignments.map((a) => <th key={a.groupId}>{a.groupLabel}</th>)}</tr></thead>
            <tbody>
              <tr><th>진척등록권한</th>{assignments.map((a) => <td key={a.groupId}>{a.hasPermission ? "Y" : "-"}</td>)}</tr>
              <tr><th>진도율</th>{assignments.map((a) => <td key={a.groupId}>{a.progressPercent}%</td>)}</tr>
            </tbody>
          </table></div> : <div className="empty">등록된 Track이 없습니다.</div>}
        </section>

        <article className="panel compact detail-summary">
          <div className="panel-head"><h2>산출물 검수</h2>{deliverable?.isOfficial && <span className="badge">공식</span>}</div>
          <dl className="wbs-field-grid">
            <div><dt>Deliverables(이슈 및 사유)</dt><dd className="prewrap">{deliverable?.note || "-"}</dd></div>
            <div><dt>공식여부</dt><dd>{deliverable?.isOfficial ? "Y" : "-"}</dd></div>
            <div><dt>파일위치</dt><dd>{deliverable?.fileUrl || "-"}</dd></div>
            <div><dt>산출물템플릿</dt><dd>{deliverable?.templateUrl || "-"}</dd></div>
            <div><dt>검수자</dt><dd>{deliverable?.reviewerName ?? "-"}</dd></div>
            <div><dt>검수실행일</dt><dd>{deliverable?.reviewedAt ?? "-"}</dd></div>
          </dl>
        </article>

        {children.length > 0 && <section className="panel compact">
          <div className="panel-head"><h2>하위 항목</h2><span>{children.length}건</span></div>
          <div className="table-wrap"><table><thead><tr><th>코드</th><th>이름</th><th>상태</th></tr></thead>
            <tbody>{children.map((child) => <tr key={child.id}>
              <td className="mono">{child.code}</td>
              <td>{canView(child.ownerUserId) ? <Link className="table-link" href={`/wbs/${child.id}`}>{child.name}</Link> : child.name}</td>
              <td>{WBS_ITEM_STATUS_LABEL[child.status]}</td>
            </tr>)}</tbody></table></div>
        </section>}

        <div className="wbs-detail-actions"><Link className="button secondary" href="/wbs">목록으로</Link><Link className="button primary" href={`/wbs/${item.id}/edit`}>수정</Link><WbsHistoryModal events={events} /></div>
      </section>
    </div>
  </>;
}
