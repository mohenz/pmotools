import Link from "next/link";
import type { DailyTaskState } from "@/lib/domain/pmo-daily";
import { meetingActionStatusLabel, meetingActionStatusTone } from "@/lib/domain/meeting-action-items";
import type { OverdueMeetingActionItems } from "@/lib/server/meeting-action-items";
import type { PmoDailyHomeDashboard, PmoHomeTask } from "@/lib/server/pmo-daily";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
const dot = (value: string | null) => (value ? value.replaceAll("-", ".") : "-");
const dayLabel = (date: string) => `${date.slice(5).replace("-", ".")} (${WEEKDAY[new Date(`${date}T00:00:00Z`).getUTCDay()]})`;
const TASK_STATE: Record<DailyTaskState, { label: string; tone: string }> = { done: { label: "종료", tone: "band-green" }, delayed: { label: "지연", tone: "band-red" }, in_progress: { label: "진행", tone: "" }, waiting: { label: "대기", tone: "" } };
const ISSUE_STATUS: Record<string, string> = { OPEN: "발생", IN_PROGRESS: "진행" };
const IMPORTANCE: Record<string, { label: string; tone: string }> = { high: { label: "상", tone: "band-red" }, medium: { label: "중", tone: "band-yellow" }, low: { label: "하", tone: "" } };

export function PmoDailyDashboardScreen({ data, overdueActions }: { data: PmoDailyHomeDashboard; overdueActions: OverdueMeetingActionItems }) {
  const delayedTotal = data.delayedGroups.reduce((sum, group) => sum + group.tasks.length, 0);
  return <>
    <header className="topbar"><div><h1>PMO Daily 대시보드</h1><p>{data.today} ({WEEKDAY[new Date(`${data.today}T00:00:00Z`).getUTCDay()]}) 기준 · WBS·캘린더·회의실·이슈 실시간 집계</p></div><div className="topbar-actions"><Link className="button secondary" href="/pmo-daily">일자별 목록</Link><Link className="button secondary" href={`/pmo-daily/new?date=${data.today}`}>오늘 PMO Daily 작성</Link></div></header>
    <div className="content pmo-daily-content">
      <section aria-label="오늘의 TASK">
        <h2 className="pmo-dash-title">1. 오늘의 TASK</h2>
        <div className="kpi-grid pmo-dash-kpis">
          <Link className="kpi" href="/wbs?status=in_progress"><span>진행</span><strong>{data.taskSummary.inProgress}</strong><small>계획기간 도래 · 미종료 · 지연 제외</small></Link>
          <Link className="kpi" href={`/wbs?actualDueDateFrom=${data.today}&actualDueDateTo=${data.today}`}><span>종료</span><strong>{data.taskSummary.doneToday}</strong><small>오늘 실적종료일 등록</small></Link>
          <Link className="kpi" href="/wbs?delayed=y"><span>지연</span><strong className={data.taskSummary.delayed ? "critical" : ""}>{data.taskSummary.delayed}</strong><small>계획일 경과 · 미착수/미종료</small></Link>
        </div>
      </section>

      <section className="panel" aria-label="WBS Task 3일">
        <div className="panel-head"><h2>2. WBS Task (어제 · 오늘 · 내일)</h2><span>영업일 기준 · 계획시작/계획종료 TASK</span></div>
        <div className="pmo-dash-days">{data.days.map((day) => <div className={`pmo-dash-day${day.key === "today" ? " today" : ""}`} key={day.key}>
          <h3>{day.label} <small>{dayLabel(day.date)}</small></h3>
          <TaskList title="시작" tasks={day.starting} />
          <TaskList title="종료" tasks={day.ending} />
        </div>)}</div>
      </section>

      <section className="panel" aria-label="주요회의일정">
        <div className="panel-head"><h2>3. 주요회의일정</h2><span><Link className="table-link" href="/calendar">캘린더</Link> · <Link className="table-link" href="/meetrooms">회의실예약</Link> · {data.meetingDays.map((day) => `${day.label} ${day.meetings.length}건`).join(" · ")}</span></div>
        <div className="table-wrap"><table><thead><tr><th>시간</th><th>구분</th><th>제목</th><th>장소</th><th>참석자</th></tr></thead>
          {data.meetingDays.map((day) => <tbody key={day.key}>
            <tr className={`pmo-dash-dayrow${day.key === "today" ? " today" : ""}`}><th colSpan={5} scope="rowgroup">{day.label} <small>{dayLabel(day.date)} · {day.meetings.length}건</small></th></tr>
            {day.meetings.map((meeting) => <tr key={meeting.id}><td className="mono">{meeting.allDay ? "종일" : `${meeting.startTime}~${meeting.endTime}`}</td><td><span className="badge">{meeting.source === "meeting" ? "회의실예약" : "캘린더"}</span></td><td><Link className="table-link" href={meeting.href}>{meeting.title}</Link>{meeting.isMilestone && <span className="badge band-yellow pmo-dash-tag">마일스톤</span>}{meeting.priority === "HIGH" && <span className="badge band-red pmo-dash-tag">중요</span>}</td><td>{meeting.location || "-"}</td><td>{meeting.attendees.join(", ") || "-"}</td></tr>)}
            {!day.meetings.length && <tr><td colSpan={5} className="pmo-dash-none">등록된 일정·회의실 예약이 없습니다.</td></tr>}
          </tbody>)}
        </table></div>
      </section>

      <section className="panel" aria-label="업무그룹별 지연 Task 현황">
        <div className="panel-head"><h2>4. 업무그룹별 지연 Task 현황</h2><span>{data.delayedGroups.length}개 그룹 · {delayedTotal}건</span></div>
        <div className="table-wrap"><table><thead><tr><th>업무그룹</th><th>Task</th><th>Task명</th><th>작업자</th><th>계획종료일</th><th>지연일수</th></tr></thead>
          <tbody>{data.delayedGroups.flatMap((group) => group.tasks.map((task, index) => <tr key={task.id}>
            {index === 0 && <td rowSpan={group.tasks.length} className="pmo-dash-group"><strong>{group.groupLabel}</strong> <small>{group.tasks.length}건</small></td>}
            <td className="mono"><Link className="table-link" href={`/wbs/${task.id}`}>{task.code}</Link></td><td>{task.name}</td><td>{task.ownerName ?? "-"}</td><td>{dot(task.dueDate)}</td><td data-numeric className={task.delayDays ? "critical" : undefined}>{task.delayDays === null ? "-" : `${task.delayDays}일`}</td>
          </tr>))}</tbody>
        </table>{!delayedTotal && <p className="empty">지연 TASK가 없습니다.</p>}</div>
      </section>

      <section className="panel" aria-label="이슈사항 현황">
        <div className="panel-head"><h2>5. 이슈사항 현황</h2><span>종료 제외 {data.issues.length}건 · <Link className="table-link" href="/issues">전체 보기</Link></span></div>
        <div className="table-wrap"><table><thead><tr><th>이슈번호</th><th>이슈구분</th><th>이슈명</th><th>중요도</th><th>담당자</th><th>발생일자</th><th>조치기한</th><th>이슈현황</th></tr></thead>
          <tbody>{data.issues.map((issue) => <tr key={issue.id}><td className="mono"><Link className="table-link" href={`/issues/${issue.id}`}>{issue.displayId}</Link></td><td>{issue.categoryLabel}</td><td>{issue.title}</td><td><span className={`badge ${IMPORTANCE[issue.importance]?.tone ?? ""}`}>{IMPORTANCE[issue.importance]?.label ?? issue.importance}</span></td><td>{issue.ownerName ?? "-"}</td><td>{dot(issue.occurredAt)}</td><td className={issue.dueAt && issue.dueAt < data.today ? "critical" : undefined}>{dot(issue.dueAt)}</td><td>{ISSUE_STATUS[issue.status] ?? issue.status}</td></tr>)}</tbody>
        </table>{!data.issues.length && <p className="empty">진행 중인 이슈가 없습니다.</p>}</div>
      </section>

      <section className="panel" aria-label="기한 경과 Action Item">
        <div className="panel-head"><h2>6. 기한 경과 Action Item</h2><span>회의록 · 완료 제외 {overdueActions.total}건{overdueActions.total > overdueActions.rows.length ? ` (오래 밀린 ${overdueActions.rows.length}건 표시)` : ""} · <Link className="table-link" href="/meeting-minutes/action-items?overdue=y">전체 보기</Link></span></div>
        <div className="table-wrap"><table><thead><tr><th>회의록</th><th>Action Item</th><th>담당자</th><th>완료예정일</th><th>경과</th><th>상태</th></tr></thead>
          <tbody>{overdueActions.rows.map((item) => <tr key={item.id}><td className="mono"><Link className="table-link" href={`/meeting-minutes/${item.minuteId}`}>{item.minuteDisplayId}</Link></td><td>{item.title || "-"}</td><td>{item.assigneeName || "-"}</td><td>{dot(item.dueDate)}</td><td data-numeric className="critical">{item.overdueDays}일</td><td><span className={`badge ${meetingActionStatusTone(item.status)}`}>{meetingActionStatusLabel(item.status)}</span></td></tr>)}</tbody>
        </table>{!overdueActions.rows.length && <p className="empty">기한이 지난 Action Item이 없습니다.</p>}</div>
      </section>
    </div>
  </>;
}

function TaskList({ title, tasks }: { title: string; tasks: PmoHomeTask[] }) {
  return <div className="pmo-dash-tasks"><h4>{title} <small>{tasks.length}건</small></h4>
    {tasks.length ? <ul>{tasks.map((task) => <li key={task.id}><Link className="table-link" href={`/wbs/${task.id}`}><span className="mono">{task.code}</span> {task.name}</Link><span>{task.ownerName ?? "-"}</span><span className={`badge ${TASK_STATE[task.state].tone}`}>{TASK_STATE[task.state].label}</span></li>)}</ul> : <p className="pmo-dash-none">해당 TASK 없음</p>}
  </div>;
}
