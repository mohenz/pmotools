"use client";
// [WBS2 복사본] 원본: screens/RequirementDetailScreen.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.

import { useState } from "react";
import Link from "next/link";
import { changeStatusLabels, requirementEventLabels } from "@/lib/domain/requirements";
import type { RequirementChangeRow, RequirementEventRow, RequirementRow } from "@/lib/server/mp/requirements";
import { RequirementInfoPanel } from "@/features/mp/requirements/RequirementInfoPanel";
import type { ProjectMemberOption } from "@/lib/server/users";
import type { CommonCode } from "@/lib/server/common-codes";

type Detail = { requirement: RequirementRow; events: RequirementEventRow[]; changes: RequirementChangeRow[] };
type CodeOptions = { members: ProjectMemberOption[]; divisions: CommonCode[]; categories: CommonCode[] };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(value));
}

export function RequirementDetailScreen({ detail, options, isManager }: { detail: Detail; options: CodeOptions; isManager: boolean }) {
  const { requirement, events, changes } = detail;
  const [editing, setEditing] = useState(false);
  // [WBS2] 원본은 로그인 세션 역할로 판단하지만, 복사본은 선택 프로젝트에서의 역할을 서버가 넘겨준다(D-3).
  return <>
    <header className="topbar"><div><p className="mono requirement-id">{requirement.requirementId || "요구사항 ID 미입력"}</p><h1>{requirement.title}</h1></div><div className="topbar-actions"><Link className="button secondary" href="/mp-requirements">목록으로</Link>{isManager && <button className="button primary" type="button" onClick={() => setEditing((v) => !v)}>{editing ? "취소" : "수정하기"}</button>}{isManager && <Link className="button secondary" href={`/mp-requirements/${requirement.id}/changes/new`}>변경요청</Link>}{isManager && <Link className="button secondary" href="/mp-requirements/changes">변경관리</Link>}</div></header>
    <div className="content">
      <section className="detail-main">
        <RequirementInfoPanel requirement={requirement} options={options} editing={editing} onEditingChange={setEditing} key={`info-${requirement.version}`} />

        <section className="panel"><div className="panel-head"><h2>변경관리</h2><span>{changes.length}건</span></div>
          <div className="change-list">{changes.length ? changes.map((change) => <article className="panel compact" key={change.id}>
            <div className="detail-badges"><span className="badge">{changeStatusLabels[change.status]}</span><time>{formatDate(change.requestedAt)}</time></div>
            <p><strong>{change.title}</strong></p>
            <p>{change.requestedByName} · {change.changeReason}</p>
            {change.decidedByName && <small>{change.decidedByName}이(가) {formatDate(change.decidedAt!)}에 처리{change.decisionNote ? ` · ${change.decisionNote}` : ""}</small>}
          </article>) : <div className="empty">제출된 변경요청이 없습니다.</div>}</div>
        </section>
      </section>
      <section className="panel"><div className="panel-head"><h2>이력정보</h2><span>{events.length}건</span></div><div className="history-list">{events.length ? events.map((event) => <article className="history-item" key={event.id}><div><span className="badge">{requirementEventLabels[event.eventType]}</span><time>{formatDate(event.createdAt)}</time></div><p>{event.body || "변경 기록"}</p><small>{event.actorName}</small></article>) : <div className="empty">기록된 이력이 없습니다.</div>}</div></section>
    </div>
  </>;
}
