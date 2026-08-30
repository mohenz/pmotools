import Link from "next/link";
import { sortKeyFromCode, WBS_ITEM_STATUS_LABEL } from "@/lib/domain/wbs";
import type { WbsExcelRow, WbsItemDetail } from "@/lib/server/wbs";
import { WbsHistoryModal } from "@/features/wbs/WbsHistoryModal";

function percent(value: number | null) {
  return value === null ? "-" : `${Math.round(value * 100)}%`;
}

export function WbsDetailScreen({ detail, excelRow }: { detail: NonNullable<WbsItemDetail>; excelRow: WbsExcelRow | null }) {
  const { item, parent, children, assignments, deliverable, events } = detail;
  return <>
    <header className="topbar"><div><p className="mono">{item.displayId} · {item.code}</p><h1>{item.name}</h1></div></header>
    <div className="content">
      <section className="detail-main wbs-detail-main">
        <article className="panel compact detail-summary">
          <div className="detail-badges"><span className="badge">{WBS_ITEM_STATUS_LABEL[item.status]}</span>{item.groupLabel && <span className="badge">{item.groupLabel}</span>}{item.stage && <span className="badge">{item.stage}</span>}</div>
          <div className="panel-head"><h2>기본 정보</h2></div>
          <dl className="wbs-field-grid">
            <div><dt>wbs_level</dt><dd>{item.level}</dd></div>
            <div><dt>sort</dt><dd className="mono">{sortKeyFromCode(item.code)}</dd></div>
            <div><dt>Project No.</dt><dd>{excelRow?.projectCode || "-"}</dd></div>
            <div><dt>Confing Status</dt><dd>{item.configStatus || "-"}</dd></div>
            <div><dt>Stage</dt><dd>{item.stage ?? "-"}</dd></div>
            <div><dt>Task</dt><dd className="mono">{item.code}</dd></div>
            <div><dt>Task Description</dt><dd>{item.name}</dd></div>
            <div><dt>TRACK</dt><dd>-</dd></div>
            <div><dt>트랜젝션코드(정렬SEQ)</dt><dd className="mono">{excelRow?.sequenceNo ?? "-"}</dd></div>
            <div><dt>상세진도(진도관리대상-4레벨)</dt><dd>{excelRow?.isLeaf ? "대상" : "-"}</dd></div>
            <div><dt>상위 항목</dt><dd>{parent ? <Link className="table-link" href={`/wbs/${parent.id}`}>{parent.code} {parent.name}</Link> : "(최상위 레벨)"}</dd></div>
            <div><dt>내용</dt><dd className="prewrap">{item.description || "-"}</dd></div>
          </dl>
        </article>

        <article className="panel compact detail-summary">
          <div className="panel-head"><h2>담당 · 일정</h2></div>
          <dl className="wbs-field-grid">
            <div><dt>R&R(실행)</dt><dd>{item.ownerName ?? "-"}</dd></div>
            <div><dt>사용자ID</dt><dd>{item.ownerLoginId ?? "-"}</dd></div>
            <div><dt>R&R(지원)(모듈)</dt><dd>{item.groupLabel ?? "-"}</dd></div>
            <div><dt>StartDate</dt><dd>{item.startDate ?? "-"}</dd></div>
            <div><dt>DueDate</dt><dd>{item.dueDate ?? "-"}</dd></div>
            <div><dt>계산 가중치(입력불필요)</dt><dd>{item.workingDays ?? "-"}</dd></div>
            <div><dt>가중치(입력불필요)</dt><dd>{item.weight ?? item.workingDays ?? "-"}{item.weight == null && item.workingDays != null && <small> (영업일수 기준 자동 산정)</small>}</dd></div>
            <div><dt>Sort(Working Day)</dt><dd>{item.workingDays ?? "-"}</dd></div>
            <div><dt>세부진도(입력불필요)</dt><dd>{Math.round(item.actualProgress * 100)}</dd></div>
          </dl>
        </article>

        <article className="panel compact detail-summary">
          <div className="panel-head"><h2>진척 현황</h2></div>
          <dl className="wbs-field-grid">
            <div><dt>목표(today)</dt><dd>{percent(item.plannedProgress)}</dd></div>
            <div><dt>실적</dt><dd>{percent(item.actualProgress)}</dd></div>
            <div><dt>진척율</dt><dd>{percent(item.progressIndex)}</dd></div>
          </dl>
        </article>

        <section className="panel compact">
          <div className="panel-head"><h2>역할별 진척등록권한·진도율</h2><span>{assignments.filter((a) => a.hasPermission).length}/{assignments.length}개 Track</span></div>
          {assignments.length ? <div className="table-wrap"><table><thead><tr><th>Track</th><th>진척등록권한</th><th>진도율</th></tr></thead>
            <tbody>{assignments.map((a) => <tr key={a.groupId}><td>{a.groupLabel}</td><td>{a.hasPermission ? "Y" : "-"}</td><td>{a.progressPercent}%</td></tr>)}</tbody></table></div> : <div className="empty">등록된 Track이 없습니다.</div>}
        </section>

        <article className="panel compact detail-summary">
          <div className="panel-head"><h2>산출물 검수</h2>{deliverable?.isOfficial && <span className="badge">공식</span>}</div>
          <dl className="wbs-field-grid">
            <div><dt>Deliverables(이슈 및 사유)</dt><dd className="prewrap">{deliverable?.note || "-"}</dd></div>
            <div><dt>공식여부(입력불필요)</dt><dd>{deliverable?.isOfficial ? "Y" : "-"}</dd></div>
            <div><dt>파일위치(입력불필요)</dt><dd>{deliverable?.fileUrl || "-"}</dd></div>
            <div><dt>산출물템플릿(입력불필요)</dt><dd>{deliverable?.templateUrl || "-"}</dd></div>
            <div><dt>검수자(입력불필요)</dt><dd>{deliverable?.reviewerName ?? "-"}</dd></div>
            <div><dt>검수실행일(입력불필요)</dt><dd>{deliverable?.reviewedAt ?? "-"}</dd></div>
          </dl>
        </article>

        {children.length > 0 && <section className="panel compact">
          <div className="panel-head"><h2>하위 항목</h2><span>{children.length}건</span></div>
          <div className="table-wrap"><table><thead><tr><th>코드</th><th>이름</th><th>상태</th></tr></thead>
            <tbody>{children.map((child) => <tr key={child.id}>
              <td className="mono">{child.code}</td>
              <td><Link className="table-link" href={`/wbs/${child.id}`}>{child.name}</Link></td>
              <td>{WBS_ITEM_STATUS_LABEL[child.status]}</td>
            </tr>)}</tbody></table></div>
        </section>}

        <div className="wbs-detail-actions"><Link className="button secondary" href="/wbs">목록으로</Link><Link className="button primary" href={`/wbs/${item.id}/edit`}>수정</Link><WbsHistoryModal events={events} /></div>
      </section>
    </div>
  </>;
}
