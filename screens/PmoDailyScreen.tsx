"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PersonPicker } from "@/components/PersonPicker";
import { PMO_DELAYED_TASK_STATUSES } from "@/lib/domain/pmo-daily";
import type { CommonCode } from "@/lib/server/common-codes";
import type { PmoDailyDashboard } from "@/lib/server/pmo-daily";
import type { ProjectMemberOption } from "@/lib/server/users";

type DelayedTask = PmoDailyDashboard["delayedTasks"][number];
const ITEM_STATUS: Record<string, string> = { registered: "등록", in_progress: "대응중", resolved: "해결", on_hold: "보류" };
const MANAGEMENT_STATUS: Record<string, string> = { IDENTIFIED: "식별", IN_PROGRESS: "진행", ISSUE_TRANSFERRED: "이슈이관", RISK_TRANSFERRED: "리스크이관", CLOSED: "종료" };

async function api(path: string, init: RequestInit) {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init.headers } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? "요청을 처리하지 못했습니다.");
  return payload;
}

export function PmoDailyScreen({ data, groups, members, mode }: { data: PmoDailyDashboard; groups: CommonCode[]; members: ProjectMemberOption[]; mode: "new" | "edit" }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  async function saveSnapshot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const form = new FormData(event.currentTarget), number = (name: string) => Number(form.get(name)) || 0;
    try {
      await api("/api/v1/pmo-daily", { method: "PUT", body: JSON.stringify({ reportDate: data.reportDate, plannedTaskCount: number("plannedTaskCount"), actualTaskCount: number("actualTaskCount"), totalTaskCount: number("totalTaskCount"), completedTaskCount: number("completedTaskCount") }) });
      setMessage("공정현황을 저장했습니다.");
      if (mode === "new") router.replace(`/pmo-daily/${data.reportDate}`); else router.refresh();
    } catch (error) { setMessage((error as Error).message); } finally { setPending(false); }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(""); const form = new FormData(event.currentTarget);
    try {
      await api("/api/v1/pmo-daily/delayed-tasks", { method: "POST", body: JSON.stringify({ reportDate: data.reportDate, groupId: form.get("groupId"), description: form.get("description"), plannedProgress: Number(form.get("plannedProgress")), actualProgress: Number(form.get("actualProgress")), plannedEndDate: form.get("plannedEndDate"), delayReason: form.get("delayReason"), responsePlan: form.get("responsePlan"), status: "IDENTIFIED", assigneeIds }) });
      setAdding(false); setAssigneeIds([]); setMessage("지연 TASK를 등록했습니다."); router.refresh();
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

      <section className="panel" id="delayed"><div className="panel-head"><h2>2. 지연 TASK</h2><button type="button" className="button primary" onClick={() => setAdding((value) => !value)}>{adding ? "추가 취소" : "+ TASK 추가"}</button></div>
        {adding && <form className="pmo-task-form" onSubmit={addTask}>
          <div className="form-grid triple"><label>업무그룹<select name="groupId" required>{groups.map((group) => <option value={group.id} key={group.id}>{group.label}</option>)}</select></label><label>계획(%)<input name="plannedProgress" type="number" min={0} max={100} defaultValue={0} required /></label><label>실적(%)<input name="actualProgress" type="number" min={0} max={100} defaultValue={0} required /></label></div>
          <label>TASK 설명<input name="description" required maxLength={500} /></label>
          <div className="form-grid"><label>계획 완료일<input name="plannedEndDate" type="date" /></label><div><span className="field-label">담당자</span><div className="attendee-picker"><PersonPicker people={members} selectedIds={assigneeIds} selectedNames={[]} allowGuests={false} onChange={(ids) => setAssigneeIds(ids)} /></div></div></div>
          <div className="form-grid"><label>지연사유<textarea name="delayReason" rows={2} maxLength={2000} /></label><label>대응방안<textarea name="responsePlan" rows={2} maxLength={2000} /></label></div>
          <button className="button primary" disabled={pending}>등록</button>
        </form>}
        <div className="pmo-task-list">{data.delayedTasks.map((task) => <DelayedTaskEditor task={task} groups={groups} members={members} onChanged={(text) => { setMessage(text); router.refresh(); }} key={task.id} />)}{!data.delayedTasks.length && <p className="empty">등록된 지연 TASK가 없습니다.</p>}</div>
      </section>

      <section className="panel" id="issues"><div className="panel-head"><h2>3. 이슈관리</h2><Link className="button secondary" href="/items">전체 보기</Link></div><div className="table-wrap"><table><thead><tr><th>ID</th><th>이슈명</th><th>업무그룹</th><th>담당자</th><th>상태</th><th>최종수정일</th></tr></thead><tbody>{data.issues.map((item) => <tr key={item.id}><td className="mono"><Link className="table-link" href={`/items/${item.id}`}>{item.displayId}</Link></td><td>{item.title}</td><td>{item.groupLabel}</td><td>{item.ownerName}</td><td>{ITEM_STATUS[item.status]}</td><td>{item.updatedAt}</td></tr>)}</tbody></table>{!data.issues.length && <p className="empty">진행 중인 이슈가 없습니다.</p>}</div></section>

      <section className="panel" id="management"><div className="panel-head"><h2>4. 관리업무현황</h2><Link className="button secondary" href="/management-tasks">전체 보기</Link></div><div className="table-wrap"><table><thead><tr><th>ID</th><th>관리업무항목명</th><th>업무그룹</th><th>담당자</th><th>현황</th><th>총점</th><th>평가상태</th></tr></thead><tbody>{data.managementTasks.map((task) => <tr key={task.id}><td className="mono"><Link className="table-link" href={`/management-tasks/${task.id}`}>{task.displayId}</Link></td><td>{task.name}</td><td>{task.groupLabel}</td><td>{task.assignees.join(", ") || "-"}</td><td>{MANAGEMENT_STATUS[task.status]}</td><td className="mono management-task-score">{task.totalScore}점</td><td><span className={`badge band-${task.band}`}>{task.band === "red" ? "위험" : task.band === "yellow" ? "주의" : "양호"}</span></td></tr>)}</tbody></table>{!data.managementTasks.length && <p className="empty">등록된 관리업무가 없습니다.</p>}</div></section>
      {message && <p className="action-message pmo-message" role="status">{message}</p>}
    </div>
  </>;
}

function MetricInput({ label, name, value, suffix }: { label: string; name: string; value: number; suffix: string }) { return <label className="pmo-metric editable"><span>{label}</span><span><input name={name} type="number" min={0} max={1_000_000} defaultValue={value} required /> <small>{suffix}</small></span></label>; }
function Metric({ label, value, tone = "" }: { label: string; value: string; tone?: string }) { return <div className={`pmo-metric ${tone}`}><span>{label}</span><strong>{value}</strong></div>; }

function DelayedTaskEditor({ task, groups, members, onChanged }: { task: DelayedTask; groups: CommonCode[]; members: ProjectMemberOption[]; onChanged: (message: string) => void }) {
  const [editing, setEditing] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState("");
  const [assigneeIds, setAssigneeIds] = useState(task.assignees.map((person) => person.id));
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setError(""); const form = new FormData(event.currentTarget); try { await api(`/api/v1/pmo-daily/delayed-tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ groupId: form.get("groupId"), description: form.get("description"), plannedProgress: Number(form.get("plannedProgress")), actualProgress: Number(form.get("actualProgress")), plannedEndDate: form.get("plannedEndDate"), delayReason: form.get("delayReason"), responsePlan: form.get("responsePlan"), status: form.get("status"), assigneeIds, version: task.version }) }); setEditing(false); onChanged("지연 TASK를 수정했습니다."); } catch (e) { setError((e as Error).message); } finally { setPending(false); } }
  async function remove() { if (!window.confirm("이 지연 TASK를 삭제할까요?")) return; setPending(true); try { await api(`/api/v1/pmo-daily/delayed-tasks/${task.id}`, { method: "DELETE", body: JSON.stringify({ version: task.version }) }); onChanged("지연 TASK를 삭제했습니다."); } catch (e) { setError((e as Error).message); setPending(false); } }
  if (!editing) return <article className="pmo-task-row"><div><span className="mono">{task.displayId}</span><strong>{task.description}</strong><small>{task.groupLabel} · {task.assignees.map((person) => person.name).join(", ") || "담당자 미지정"}</small></div><dl><div><dt>계획/실적</dt><dd>{task.plannedProgress}% / {task.actualProgress}%</dd></div><div><dt>지연율</dt><dd className={task.delayRate ? "critical" : ""}>{task.delayRate}%</dd></div><div><dt>지연일수</dt><dd>{task.delayDays}일</dd></div><div><dt>상태</dt><dd>{PMO_DELAYED_TASK_STATUSES.find((item) => item.value === task.status)?.label}</dd></div></dl><div className="pmo-task-reason"><p><b>지연사유</b>{task.delayReason || "-"}</p><p><b>대응방안</b>{task.responsePlan || "-"}</p></div><div className="topbar-actions"><button type="button" className="button secondary" onClick={() => setEditing(true)}>수정</button><button type="button" className="button danger" onClick={remove} disabled={pending}>삭제</button></div>{error && <p className="form-error">{error}</p>}</article>;
  return <form className="pmo-task-form" onSubmit={save}><div className="form-grid triple"><label>업무그룹<select name="groupId" defaultValue={task.groupId}>{groups.map((group) => <option value={group.id} key={group.id}>{group.label}</option>)}</select></label><label>계획(%)<input name="plannedProgress" type="number" min={0} max={100} defaultValue={task.plannedProgress} /></label><label>실적(%)<input name="actualProgress" type="number" min={0} max={100} defaultValue={task.actualProgress} /></label></div><label>TASK 설명<input name="description" defaultValue={task.description} required /></label><div className="form-grid"><label>계획 완료일<input name="plannedEndDate" type="date" defaultValue={task.plannedEndDate ?? ""} /></label><label>상태<select name="status" defaultValue={task.status}>{PMO_DELAYED_TASK_STATUSES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label></div><div><span className="field-label">담당자</span><div className="attendee-picker"><PersonPicker people={members} selectedIds={assigneeIds} selectedNames={[]} allowGuests={false} onChange={(ids) => setAssigneeIds(ids)} /></div></div><div className="form-grid"><label>지연사유<textarea name="delayReason" rows={2} defaultValue={task.delayReason} /></label><label>대응방안<textarea name="responsePlan" rows={2} defaultValue={task.responsePlan} /></label></div>{error && <p className="form-error">{error}</p>}<div className="topbar-actions"><button className="button primary" disabled={pending}>{pending ? "저장 중…" : "저장"}</button><button type="button" className="button secondary" onClick={() => setEditing(false)}>취소</button></div></form>;
}
