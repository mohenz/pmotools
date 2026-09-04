"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { PmoDailyDashboard } from "@/lib/server/pmo-daily";

const dot = (value: string | null) => (value ? value.replaceAll("-", ".") : "-");
const ISSUE_STATUS: Record<string, string> = { OPEN: "발생", IN_PROGRESS: "진행", CLOSED: "종결" };
const MANAGEMENT_STATUS: Record<string, string> = { IDENTIFIED: "식별", IN_PROGRESS: "진행", ISSUE_TRANSFERRED: "이슈이관", RISK_TRANSFERRED: "리스크이관", CLOSED: "종료" };

async function api(path: string, init: RequestInit) {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init.headers } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? "요청을 처리하지 못했습니다.");
  return payload;
}

export function PmoDailyScreen({ data, mode }: { data: PmoDailyDashboard; mode: "new" | "edit" }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function saveSnapshot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const form = new FormData(event.currentTarget), number = (name: string) => Number(form.get(name)) || 0;
    try {
      await api("/api/v1/pmo-daily", { method: "PUT", body: JSON.stringify({ reportDate: data.reportDate, plannedTaskCount: number("plannedTaskCount"), actualTaskCount: number("actualTaskCount"), totalTaskCount: number("totalTaskCount"), completedTaskCount: number("completedTaskCount") }) });
      setMessage("공정현황을 저장했습니다.");
      if (mode === "new") router.replace(`/pmo-daily/${data.reportDate}`); else router.refresh();
    } catch (error) { setMessage((error as Error).message); } finally { setPending(false); }
  }

  return <>
    <header className="topbar"><div><h1>{mode === "new" && !data.exists ? "PMO Daily 신규 작성" : "PMO Daily"}</h1><p>{data.reportDate} 기준 프로젝트 통제 현황</p></div><div className="topbar-actions"><Link className="button secondary" href="/pmo-daily">목록</Link>{mode === "edit" && <Link className="button secondary" href="/pmo-daily/new">+ 신규 작성</Link>}</div></header>
    <div className="content pmo-daily-content">
      <form className="pmo-date-filter panel compact" action="/pmo-daily/new"><label>기준일<input type="date" name="date" defaultValue={data.reportDate} /></label><button className="button secondary">해당 일자 작성·조회</button>{data.exists && mode === "new" && <span className="badge">이미 저장된 일자입니다. 저장하면 기존 기록이 수정됩니다.</span>}</form>
      <section className="panel" id="progress"><div className="panel-head"><h2>1. 공정현황</h2><span>직접 입력 · 지연지표 자동 계산</span></div>
        <form className="pmo-progress-form" onSubmit={saveSnapshot}>
          <MetricInput label="계획 TASK" name="plannedTaskCount" value={data.snapshot.plannedTaskCount} suffix="건" />
          <MetricInput label="실적 TASK" name="actualTaskCount" value={data.snapshot.actualTaskCount} suffix="건" />
          <Metric label="공정률" value={`${data.metrics.scheduleProgress}%`} tone="primary" />
          <Metric label="지연 TASK" value={`${data.metrics.delayedTaskCount}건`} />
          <Metric label="지연율" value={`${data.metrics.delayedRate}%`} />
          <MetricInput label="전체 TASK" name="totalTaskCount" value={data.snapshot.totalTaskCount} suffix="건" />
          <MetricInput label="완료 TASK" name="completedTaskCount" value={data.snapshot.completedTaskCount} suffix="건" />
          <Metric label="전체 공정률" value={`${data.metrics.overallProgress}%`} tone="primary" />
          <button className="button primary pmo-progress-save" disabled={pending}>{pending ? "저장 중…" : "공정현황 저장"}</button>
        </form>
      </section>

      <section className="panel" id="delayed"><div className="panel-head"><h2>2. 지연 TASK</h2><span>오늘종료예정 미종료 {data.delayedTaskTotal}건</span></div>
        <div className="table-wrap"><table><thead><tr><th>Task</th><th>Task명</th><th>업무그룹</th><th>담당자</th><th>계획시작일</th><th>계획종료일</th><th>실적시작일</th><th>실적종료일</th><th>지연일수</th></tr></thead>
          <tbody>{data.delayedTasks.map((task) => <tr key={task.id}><td className="mono"><Link className="table-link" href={`/wbs/${task.id}`}>{task.code}</Link></td><td>{task.name}</td><td>{task.groupLabel ?? "-"}</td><td>{task.ownerName ?? "-"}</td><td>{dot(task.startDate)}</td><td>{dot(task.dueDate)}</td><td>{dot(task.actualStartDate)}</td><td>{dot(task.actualDueDate)}</td><td data-numeric className={task.delayDays ? "critical" : undefined}>{task.delayDays === null ? "-" : `${task.delayDays}일`}</td></tr>)}</tbody>
        </table>{!data.delayedTasks.length && <p className="empty">오늘종료예정 TASK가 모두 종료되었습니다.</p>}</div>
      </section>

      <section className="panel" id="issues"><div className="panel-head"><h2>3. 이슈관리</h2><Link className="button secondary" href="/issues">전체 보기</Link></div><div className="table-wrap"><table><thead><tr><th>이슈번호</th><th>이슈구분</th><th>발생일자</th><th>이슈명</th><th>이슈현황</th></tr></thead><tbody>{data.issues.map((item) => <tr key={item.id}><td className="mono"><Link className="table-link" href={`/issues/${item.id}`}>{item.displayId}</Link></td><td>{item.categoryLabel}</td><td>{dot(item.occurredAt)}</td><td>{item.title}</td><td>{ISSUE_STATUS[item.status]}</td></tr>)}</tbody></table>{!data.issues.length && <p className="empty">진행 중인 이슈가 없습니다.</p>}</div></section>

      <section className="panel" id="management"><div className="panel-head"><h2>4. 관리업무현황</h2><Link className="button secondary" href="/management-tasks">전체 보기</Link></div><div className="table-wrap"><table><thead><tr><th>ID</th><th>관리업무항목명</th><th>업무그룹</th><th>담당자</th><th>현황</th><th>총점</th><th>평가상태</th></tr></thead><tbody>{data.managementTasks.map((task) => <tr key={task.id}><td className="mono"><Link className="table-link" href={`/management-tasks/${task.id}`}>{task.displayId}</Link></td><td>{task.name}</td><td>{task.groupLabel}</td><td>{task.assignees.join(", ") || "-"}</td><td>{MANAGEMENT_STATUS[task.status]}</td><td className="mono management-task-score">{task.totalScore}점</td><td><span className={`badge band-${task.band}`}>{task.band === "red" ? "위험" : task.band === "yellow" ? "주의" : "양호"}</span></td></tr>)}</tbody></table>{!data.managementTasks.length && <p className="empty">등록된 관리업무가 없습니다.</p>}</div></section>
      {message && <p className="action-message pmo-message" role="status">{message}</p>}
    </div>
  </>;
}

function MetricInput({ label, name, value, suffix }: { label: string; name: string; value: number; suffix: string }) { return <label className="pmo-metric editable"><span>{label}</span><span><input name={name} type="number" min={0} max={1_000_000} defaultValue={value} required /> <small>{suffix}</small></span></label>; }
function Metric({ label, value, tone = "" }: { label: string; value: string; tone?: string }) { return <div className={`pmo-metric ${tone}`}><span>{label}</span><strong>{value}</strong></div>; }
