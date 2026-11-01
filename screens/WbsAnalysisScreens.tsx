import Link from "next/link";
import type { ReactNode } from "react";
import { InfoTip } from "@/components/InfoTip";
import type { WorkloadAnalysis, WorkloadGroupRow, WorkloadLevel, WorkloadOwnerRow, WorkloadPerf, WorkloadTask } from "@/lib/domain/wbs-workload";
import { BALANCED_CV, HEAVY_RATIO, LIGHT_RATIO, NORMAL_CV, RATING_HIGH_MIN, RATING_MID_MIN, monthlyTaskCounts, rateProductivity, TASK_CHART_RANGE, taskStateOf } from "@/lib/domain/wbs-workload";

// WBS 분석 메뉴(대시보드·생산성·인당부하)의 세 화면. 원본(/wbs)과 다중 프로젝트(/mp-wbs)가 함께 쓰며,
// 계산은 lib/domain/wbs-workload.ts, 데이터 조회만 경로별로 다르다.

const fmt = (value: number) => value.toLocaleString("ko-KR");
const load = (value: number) => (value > 0 ? value.toFixed(2) : "-");
const pct = (value: number) => `${(value * 100).toFixed(0)}%`;
const rate = (value: number | null) => (value === null ? "-" : pct(value));
const monthLabel = (month: string) => `${month.slice(2, 4)}.${month.slice(5)}`;
const GRADE_NOTE = { A: "표본 충분", B: "참고", C: "표본 부족", D: "비교 불가" } as const;
const GRADE_TONE = { A: "band-green", B: "band-blue", C: "band-yellow", D: "band-red" } as const;
const RATING_BADGE = { high: ["band-green", "상"], mid: ["band-blue", "중"], low: ["band-red", "하"] } as const;
function RatingCell({ perf }: { perf: WorkloadPerf }) {
  const rating = rateProductivity(perf);
  if (!rating) return <td><span className="badge">평가 불가</span></td>;
  const [tone, text] = RATING_BADGE[rating];
  return <td><span className={`badge ${tone}`}>{text}</span></td>;
}
const BALANCE_BADGE = { balanced: ["band-green", "균형"], normal: ["band-yellow", "보통"], skewed: ["band-red", "편중"] } as const;
const EMPTY = "계획 시작일·종료일이 입력된 진척관리 대상(leaf) 항목이 없습니다.";

function PerfCells({ perf, showGrade = true }: { perf: WorkloadPerf; showGrade?: boolean }) {
  return <>
    <td data-numeric>{fmt(perf.assigned)}</td>
    <td data-numeric>{fmt(perf.due)}</td>
    <td data-numeric>{fmt(perf.dueDone)}</td>
    <td data-numeric>{rate(perf.dueRate)}</td>
    <td data-numeric>{rate(perf.dayRate)}</td>
    <td data-numeric>{rate(perf.onTimeRate)}</td>
    <td data-numeric>{perf.overdue ? <span className="badge band-red">{fmt(perf.overdue)}</span> : "-"}</td>
    <td data-numeric>{perf.throughput === null ? "-" : perf.throughput.toFixed(2)}</td>
    {showGrade ? <td><span className={`badge ${GRADE_TONE[perf.grade]}`}>{perf.grade} {GRADE_NOTE[perf.grade]}</span></td> : null}
  </>;
}

const PerfHead = ({ showGrade = true }: { showGrade?: boolean }) => <>
  <th data-numeric>배치</th><th data-numeric>기한 도래</th><th data-numeric>완료</th><th data-numeric>처리율</th><th data-numeric>영업일 가중</th>
  <th data-numeric>정시 완료율</th><th data-numeric>기한 경과 미완료</th><th data-numeric>부하당 월 처리</th>{showGrade ? <th>표본</th> : null}
</>;

function Header({ title, description, tip }: { title: string; description: string; tip?: ReactNode }) {
  return <header className="topbar"><div><h1>{title}{tip}</h1><p>{description}</p></div></header>;
}

const LOAD_TIP = <InfoTip label="인당 부하란?">
  <strong>인당 부하</strong>란 한 사람이 한 달 동안 평균 몇 건의 Task를 동시에 진행하는지를 나타내는 값입니다.
  <ul>
    <li>계산: 그 달에 걸친 계획 Task의 영업일 합 ÷ 그 달 영업일 (주말만 제외, 공휴일 미반영)</li>
    <li>예: 11월 내내 걸친 Task 2건 = 2.0, 한 건은 절반만 걸치면 1.5</li>
    <li>과다는 그 달 배치 담당자 중앙값의 1.5배 이상, 여유는 0.5배 이하</li>
    <li>계획 일정만으로 센 값이라 실제 투입 시간·공수·난이도는 반영하지 않으며, 담당자 미지정 Task는 제외됩니다.</li>
  </ul>
</InfoTip>;

/** 대시보드 — 한눈에 보는 요약과 주의 대상. 세부는 생산성·인당부하 화면으로 연결한다. */
export function WbsAnalysisDashboardScreen({ analysis, basePath }: { analysis: WorkloadAnalysis; basePath: string }) {
  const { months, timeline, groups, owners } = analysis;
  const maxPerOwner = Math.max(0, ...timeline.map((row) => row.perOwner));
  const heavyOwners = owners.filter((owner) => owner.heavyMonths > 0).sort((a, b) => b.heavyMonths - a.heavyMonths || b.peak - a.peak).slice(0, 5);
  const overdueOwners = owners.filter((owner) => owner.perf.overdue > 0).sort((a, b) => b.perf.overdue - a.perf.overdue).slice(0, 5);
  const lowGroups = groups.filter((group) => group.perf.due > 0 && group.perf.dueRate !== null).sort((a, b) => a.perf.dueRate! - b.perf.dueRate!).slice(0, 5);
  return <>
    <Header title="WBS 분석 대시보드" description="계획 대비 업무 배분 현황과 처리 현황 요약" />
    <div className="content">
      {!months.length ? <section className="panel"><div className="empty">{EMPTY}</div></section> : <>
        <section className="kpi-grid kpi-grid-6">
          <div className="kpi"><span>분석 기간</span><strong>{months.length}개월</strong><small>{analysis.rangeStart} ~ {analysis.rangeEnd}</small></div>
          <div className="kpi"><span>처리율</span><strong>{rate(analysis.perf.dueRate)}</strong><small>{analysis.asOf} 기준 기한 도래 {fmt(analysis.perf.due)}건 중 {fmt(analysis.perf.dueDone)}건 완료</small></div>
          <div className="kpi"><span>기한 경과 미완료</span><strong className={analysis.perf.overdue > 0 ? "critical" : undefined}>{fmt(analysis.perf.overdue)}건</strong><small>정시 완료율 {rate(analysis.perf.onTimeRate)}</small></div>
          <div className="kpi"><span>담당자 미지정</span><strong className={analysis.unassignedTasks > 0 ? "critical" : undefined}>{fmt(analysis.unassignedTasks)}건</strong><small>분석 Task {fmt(analysis.totalTasks)}건{analysis.excludedTasks ? ` · 일정 미입력 ${fmt(analysis.excludedTasks)}건 제외` : ""}</small></div>
          <div className="kpi"><span>편중 월</span><strong className={analysis.skewedMonths > 0 ? "critical" : undefined}>{fmt(analysis.skewedMonths)}/{months.length}개월</strong><small>담당자 간 부하 편차(변동계수) {NORMAL_CV} 초과</small></div>
          <div className="kpi"><span>시작 집중 월</span><strong>{analysis.peakStartMonth}</strong><small>전체 시작의 {pct(analysis.peakStartShare)}가 이 달에 시작</small></div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>월별 인당 부하</h2><Link className="table-link" href={`${basePath}/workload`}>인당부하 상세</Link></div>
          <div className="table-wrap"><table>
            <thead><tr><th>월</th><th data-numeric>시작</th><th data-numeric>종료</th><th data-numeric>진행 Task</th><th data-numeric>배치 인원</th><th data-numeric>인당 부하</th><th>추이</th><th>균형</th></tr></thead>
            <tbody>{timeline.map((row) => { const [tone, text] = BALANCE_BADGE[row.balance]; return <tr key={row.month}>
              <td>{row.month}</td>
              <td data-numeric>{fmt(row.started)}</td>
              <td data-numeric>{fmt(row.ended)}</td>
              <td data-numeric>{fmt(row.active)}</td>
              <td data-numeric>{fmt(row.owners)}명</td>
              <td data-numeric>{load(row.perOwner)}</td>
              <td><span className="load-bar"><i style={{ width: `${maxPerOwner ? (row.perOwner / maxPerOwner) * 100 : 0}%` }} /></span></td>
              <td><span className={`badge ${tone}`}>{text}</span></td>
            </tr>; })}</tbody>
          </table></div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>주의 담당자 — 과다 배치</h2><Link className="table-link" href={`${basePath}/workload`}>인당부하 상세</Link></div>
          {heavyOwners.length ? <div className="table-wrap"><table>
            <thead><tr><th>담당자</th><th>업무그룹</th><th data-numeric>과다 월</th><th data-numeric>최대 부하</th><th data-numeric>최대 부하 월</th></tr></thead>
            <tbody>{heavyOwners.map((owner) => <tr key={owner.ownerKey}>
              <td>{owner.ownerName}</td><td>{owner.groupLabel}</td>
              <td data-numeric><span className="badge band-red">{owner.heavyMonths}</span></td>
              <td data-numeric>{load(owner.peak)}</td>
              <td data-numeric>{owner.peakMonth ?? "-"}</td>
            </tr>)}</tbody>
          </table></div> : <div className="empty">과다 배치 월이 있는 담당자가 없습니다.</div>}
        </section>

        <section className="panel">
          <div className="panel-head"><h2>주의 담당자 — 기한 경과 미완료</h2><Link className="table-link" href={`${basePath}/productivity`}>생산성 상세</Link></div>
          {overdueOwners.length ? <div className="table-wrap"><table>
            <thead><tr><th>담당자</th><th>업무그룹</th><th data-numeric>기한 경과 미완료</th><th data-numeric>기한 도래</th><th data-numeric>처리율</th><th>표본</th></tr></thead>
            <tbody>{overdueOwners.map((owner) => <tr key={owner.ownerKey}>
              <td>{owner.ownerName}</td><td>{owner.groupLabel}</td>
              <td data-numeric><span className="badge band-red">{fmt(owner.perf.overdue)}</span></td>
              <td data-numeric>{fmt(owner.perf.due)}</td>
              <td data-numeric>{rate(owner.perf.dueRate)}</td>
              <td><span className={`badge ${GRADE_TONE[owner.perf.grade]}`}>{owner.perf.grade} {GRADE_NOTE[owner.perf.grade]}</span></td>
            </tr>)}</tbody>
          </table></div> : <div className="empty">기한이 지났는데 끝나지 않은 Task가 없습니다.</div>}
        </section>

        <section className="panel">
          <div className="panel-head"><h2>처리율이 낮은 업무그룹</h2><Link className="table-link" href={`${basePath}/productivity`}>생산성 상세</Link></div>
          {lowGroups.length ? <div className="table-wrap"><table>
            <thead><tr><th>업무그룹</th><th data-numeric>인원</th><th data-numeric>기한 도래</th><th data-numeric>처리율</th><th data-numeric>기한 경과 미완료</th><th>그룹 내 처리율 범위</th></tr></thead>
            <tbody>{lowGroups.map((group) => <tr key={group.groupLabel}>
              <td>{group.groupLabel}</td>
              <td data-numeric>{fmt(group.owners)}명</td>
              <td data-numeric>{fmt(group.perf.due)}</td>
              <td data-numeric>{rate(group.perf.dueRate)}</td>
              <td data-numeric>{group.perf.overdue ? <span className="badge band-red">{fmt(group.perf.overdue)}</span> : "-"}</td>
              <td>{group.rateMin === null || group.rateMax === null ? "-" : `${rate(group.rateMin)} ~ ${rate(group.rateMax)} (${group.rateCount}명)`}</td>
            </tr>)}</tbody>
          </table></div> : <div className="empty">기한이 도래한 Task가 있는 업무그룹이 없습니다.</div>}
          <p className="matrix-note">점수나 순위가 아니라 확인이 필요한 대상을 추려 보여 주는 화면입니다. 담당자별 판단은 세부 화면의 표본 등급을 함께 확인하세요.</p>
        </section>
      </>}
    </div>
  </>;
}

const TASK_STATE_BADGE = { done: ["band-green", "완료"], overdue: ["band-red", "기한 경과 미완료"], open: ["band-blue", "진행·예정"] } as const;

/** 소속 WBS Task 현황 표 — 기한 경과 미완료 → 진행·예정 → 완료 순. 생산성·인당부하 상세가 함께 쓴다. */
function TaskStatusPanel({ tasks, asOf, showOwner }: { tasks: WorkloadTask[]; asOf: string; showOwner: boolean }) {
  const sorted = [...tasks].sort((a, b) => {
    const order = { overdue: 0, open: 1, done: 2 } as const;
    return order[taskStateOf(a, asOf)] - order[taskStateOf(b, asOf)] || (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || (a.taskCode ?? "").localeCompare(b.taskCode ?? "");
  });
  return (
    <section className="panel">
      <div className="panel-head"><h2>WBS Task 현황</h2><span>{fmt(sorted.length)}건 · 기한 경과 미완료 → 진행·예정 → 완료 순</span></div>
      {sorted.length ? <div className="table-wrap"><table>
        <thead><tr><th>WBS 코드</th><th>Task</th>{showOwner ? <th>담당자</th> : null}<th>계획 시작</th><th>계획 종료</th><th>실적 종료</th><th data-numeric>진도율</th><th>상태</th></tr></thead>
        <tbody>{sorted.map((task, index) => { const [tone, text] = TASK_STATE_BADGE[taskStateOf(task, asOf)]; return <tr key={`${task.taskCode ?? "task"}-${index}`}>
          <td>{task.taskCode ?? "-"}</td>
          <td>{task.taskName ?? "-"}</td>
          {showOwner ? <td>{task.ownerName ?? "미지정"}</td> : null}
          <td>{task.startDate ?? "-"}</td>
          <td>{task.dueDate ?? "-"}</td>
          <td>{task.actualDueDate ?? "-"}</td>
          <td data-numeric>{task.progress === undefined ? "-" : pct(task.progress)}</td>
          <td><span className={`badge ${tone}`}>{text}</span></td>
        </tr>; })}</tbody>
      </table></div> : <div className="empty">표시할 Task가 없습니다.</div>}
      <p className="matrix-note">기한 경과 미완료 = 계획 종료일이 기준일({asOf}) 이전인데 완료되지 않은 Task. 일정이 입력되지 않은 Task는 생산성 계산에는 빠지지만 이 목록에는 함께 표시됩니다.</p>
    </section>
  );
}

/** 생산성 상세 — 업무그룹 또는 담당자 한 곳의 생산성 현황과 소속 WBS Task 현황. */
export function WbsProductivityDetailScreen({ analysis, basePath, kind, row, tasks }: {
  analysis: WorkloadAnalysis; basePath: string; kind: "group" | "owner";
  row: { title: string; groupLabel: string; perf: WorkloadPerf; owners?: number }; tasks: WorkloadTask[];
}) {
  const { perf } = row;
  const rating = rateProductivity(perf);
  const monthly = monthlyTaskCounts(tasks, analysis.asOf, TASK_CHART_RANGE);
  const outsideRange = tasks.filter((task) => task.dueDate && (task.dueDate.slice(0, 7) < TASK_CHART_RANGE.from || task.dueDate.slice(0, 7) > TASK_CHART_RANGE.to)).length;
  const maxMonthTotal = Math.max(1, ...monthly.map((row) => row.total));
  const groupHref =`${basePath}/productivity?group=${encodeURIComponent(row.groupLabel)}`;
  return <>
    <Header title={`${row.title} 생산성`} description={kind === "group" ? "업무그룹의 생산성 현황과 소속 WBS Task 현황" : `${row.groupLabel} · 담당자의 생산성 현황과 담당 WBS Task 현황`} />
    <div className="content">
      <div className="panel-head"><Link className="table-link" href={`${basePath}/productivity`}>← 생산성 분석으로</Link>{kind === "owner" ? <Link className="table-link" href={groupHref}>업무그룹 {row.groupLabel} 보기</Link> : null}</div>
      <section className="kpi-grid kpi-grid-6">
        <div className="kpi"><span>평가</span><strong>{rating ? RATING_BADGE[rating][1] : "평가 불가"}</strong><small>{GRADE_NOTE[perf.grade]} · 기한 도래 {fmt(perf.due)}건 기준</small></div>
        <div className="kpi"><span>처리율</span><strong>{rate(perf.dueRate)}</strong><small>{analysis.asOf} 기준 기한 도래 {fmt(perf.due)}건 중 {fmt(perf.dueDone)}건 완료</small></div>
        <div className="kpi"><span>영업일 가중 처리율</span><strong>{rate(perf.dayRate)}</strong><small>큰 Task를 더 크게 반영</small></div>
        <div className="kpi"><span>정시 완료율</span><strong>{rate(perf.onTimeRate)}</strong><small>완료 {fmt(perf.doneDated)}건 중 계획 종료일 이내 {fmt(perf.doneOnTime)}건</small></div>
        <div className="kpi"><span>기한 경과 미완료</span><strong className={perf.overdue > 0 ? "critical" : undefined}>{fmt(perf.overdue)}건</strong><small>배치 {fmt(perf.assigned)}건 · 완료 {fmt(perf.done)}건</small></div>
        <div className="kpi"><span>부하당 월 처리</span><strong>{perf.throughput === null ? "-" : perf.throughput.toFixed(2)}</strong><small>{kind === "group" ? `${fmt(row.owners ?? 0)}명 합산` : "기준일까지 월 부하 대비 완료"}</small></div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>월별 Task 수량</h2><span>계획 종료월 기준 · {TASK_CHART_RANGE.from} ~ {TASK_CHART_RANGE.to}{outsideRange ? ` · 기간 밖 ${fmt(outsideRange)}건 제외` : ""}</span></div>
        {monthly.length ? <>
          <div className="month-chart" role="img" aria-label={`계획 종료월별 Task 수량: ${monthly.map((row) => `${row.month} ${row.total}건`).join(", ")}`}>
            <div className="month-chart-inner">
              <div className="month-chart-plot">
                {monthly.map((row) => { const top = (row.total / (maxMonthTotal * 1.15)) * 100; return <div className="month-chart-col" key={row.month} title={`${row.month} · 완료 ${row.done} · 기한 경과 미완료 ${row.overdue} · 진행·예정 ${row.open}`}>
                  <div className="month-chart-bar" style={{ height: `${top}%` }}>
                    {row.open ? <i className="open" style={{ flexGrow: row.open }} /> : null}
                    {row.overdue ? <i className="overdue" style={{ flexGrow: row.overdue }} /> : null}
                    {row.done ? <i className="done" style={{ flexGrow: row.done }} /> : null}
                  </div>
                  <span className="month-chart-dot" style={{ bottom: `${top}%` }} />
                  <span className="month-chart-total" style={{ bottom: `${top}%` }}>{row.total || ""}</span>
                </div>; })}
                <svg className="month-chart-trend" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polyline vectorEffect="non-scaling-stroke" points={monthly.map((row, index) => `${((index + 0.5) / monthly.length) * 100},${100 - (row.total / (maxMonthTotal * 1.15)) * 100}`).join(" ")} />
                </svg>
              </div>
              <div className="month-chart-axis">{monthly.map((row) => <span key={row.month}>{monthLabel(row.month)}</span>)}</div>
            </div>
          </div>
          <div className="month-chart-legend"><span><i className="done" />완료</span><span><i className="overdue" />기한 경과 미완료</span><span><i className="open" />진행·예정</span><span><i className="trend" />월별 추이</span></div>
        </> : <div className="empty">계획 종료일이 있는 Task가 없습니다.</div>}
      </section>

      <TaskStatusPanel tasks={tasks} asOf={analysis.asOf} showOwner={kind === "group"} />
    </div>
  </>;
}

/** 생산성 — 기준일까지 도래한 배치 대비 산출(그룹·담당자). */
export function WbsProductivityScreen({ analysis, basePath }: { analysis: WorkloadAnalysis; basePath: string }) {
  const { months, groups, owners } = analysis;
  return <>
    <Header title="WBS 생산성 분석" description="기한이 도래한 배치 대비 처리 현황 · 업무그룹과 담당자별" />
    <div className="content">
      {!months.length ? <section className="panel"><div className="empty">{EMPTY}</div></section> : <>
        <section className="kpi-grid">
          <div className="kpi"><span>처리율</span><strong>{rate(analysis.perf.dueRate)}</strong><small>{analysis.asOf} 기준 기한 도래 {fmt(analysis.perf.due)}건 중 {fmt(analysis.perf.dueDone)}건 완료</small></div>
          <div className="kpi"><span>영업일 가중 처리율</span><strong>{rate(analysis.perf.dayRate)}</strong><small>큰 Task를 더 크게 반영</small></div>
          <div className="kpi"><span>정시 완료율</span><strong>{rate(analysis.perf.onTimeRate)}</strong><small>완료 {fmt(analysis.perf.doneDated)}건 중 계획 종료일 이내 {fmt(analysis.perf.doneOnTime)}건</small></div>
          <div className="kpi"><span>기한 경과 미완료</span><strong className={analysis.perf.overdue > 0 ? "critical" : undefined}>{fmt(analysis.perf.overdue)}건</strong><small>담당자 미지정 {fmt(analysis.unassignedTasks)}건 포함 전체 기준</small></div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>업무그룹별 생산성</h2><span>기준일 {analysis.asOf}</span></div>
          <div className="table-wrap"><table>
            <thead><tr><th>업무그룹</th><th data-numeric>인원</th><PerfHead showGrade={false} /><th>그룹 내 처리율 범위</th><th>평가</th></tr></thead>
            <tbody>{groups.map((group) => <tr key={group.groupLabel}>
              <td><Link className="table-link" href={`${basePath}/productivity?group=${encodeURIComponent(group.groupLabel)}`}>{group.groupLabel}</Link></td>
              <td data-numeric>{fmt(group.owners)}명</td>
              <PerfCells perf={group.perf} showGrade={false} />
              <td>{group.rateMin === null || group.rateMax === null ? "-" : `${rate(group.rateMin)} ~ ${rate(group.rateMax)} (${group.rateCount}명)`}</td>
              <RatingCell perf={group.perf} />
            </tr>)}</tbody>
          </table></div>
          <p className="matrix-note">평가 = 처리율 기준 상 {pct(RATING_HIGH_MIN)} 이상, 중 {pct(RATING_MID_MIN)} 이상 {pct(RATING_HIGH_MIN)} 미만, 하 {pct(RATING_MID_MIN)} 미만이며, 기한이 도래한 Task가 5건 미만이면 평가 불가로 표시합니다. 처리율 =기준일까지 계획 종료일이 도래한 Task 중 완료 비율. 영업일 가중은 건수 대신 계획 영업일로 센 값이라 큰 Task를 더 크게 반영합니다. 부하당 월 처리 = 완료 건수 ÷ 기준일까지의 월 부하 합으로, 같은 시간 동안 같은 수를 동시에 진행했을 때 얼마나 끝냈는지를 비교합니다. 그룹 내 처리율 범위가 넓으면 같은 그룹 안에서 배분 또는 처리 속도 편차가 큰 것입니다(표본 A·B 담당자만 비교).</p>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>담당자별 생산성</h2><span>{owners.length}명</span></div>
          <div className="table-wrap"><table>
            <thead><tr><th>담당자</th><th>업무그룹</th><PerfHead /><th>평가</th></tr></thead>
            <tbody>{owners.map((owner) => <tr key={owner.ownerKey}>
              <td><Link className="table-link" href={`${basePath}/productivity?owner=${encodeURIComponent(owner.ownerKey)}`}>{owner.ownerName}</Link></td>
              <td>{owner.groupLabel}</td>
              <PerfCells perf={owner.perf} />
              <RatingCell perf={owner.perf} />
            </tr>)}</tbody>
          </table></div>
          <p className="matrix-note">표본 등급은 기한이 도래한 Task 수 기준입니다(A 10건 이상, B 5~9건, C 1~4건, D 없음). C·D 등급의 비율은 한두 건에 크게 흔들리므로 비교하지 마세요. 이 화면은 점수나 순위를 매기지 않으며, 완료 Task의 실적 종료일이 계획과 거의 같게 기록되는 프로젝트에서는 정시 완료율이 실제보다 높게 나옵니다. 처리 속도 비교는 완료 처리된 건수 기준으로만 해석하세요.</p>
        </section>
      </>}
    </div>
  </>;
}

/** 인당부하 — 계획 일정만으로 본 월별 배치량과 그룹·담당자 간 편중. */
export function WbsWorkloadScreen({ analysis, basePath }: { analysis: WorkloadAnalysis; basePath: string }) {
  const { months, timeline, groups, owners } = analysis;
  const maxPerOwner = Math.max(0, ...timeline.map((row) => row.perOwner));
  const levelClass = (level: WorkloadLevel | null) => (level === "heavy" ? "heavy" : level === "light" ? "light" : "");
  const groupLevel = (value: number, index: number): WorkloadLevel | null => {
    const base = timeline[index].perOwner;
    if (value <= 0) return null;
    if (base > 0 && value >= base * HEAVY_RATIO) return "heavy";
    if (base > 0 && value <= base * LIGHT_RATIO) return "light";
    return "normal";
  };
  return <>
    <Header title="WBS 인당 부하 분석" description="프로젝트 시작부터 종료까지 계획 일정 기준 월별 업무 배분 현황과 그룹·담당자 간 편중" tip={LOAD_TIP} />
    <div className="content">
      {!months.length ? <section className="panel"><div className="empty">{EMPTY}</div></section> : <>
        <section className="kpi-grid kpi-grid-5 kpi-compact">
          <div className="kpi"><span>분석 기간</span><strong>{months.length}개월</strong><small>{analysis.rangeStart} ~ {analysis.rangeEnd}</small></div>
          <div className="kpi"><span>분석 Task</span><strong>{fmt(analysis.totalTasks)}건</strong><small>{analysis.excludedTasks ? `일정 미입력 ${fmt(analysis.excludedTasks)}건 제외` : "전 건 일정 입력"}</small></div>
          <div className="kpi"><span>담당자 미지정</span><strong className={analysis.unassignedTasks > 0 ? "critical" : undefined}>{fmt(analysis.unassignedTasks)}건</strong><small>부하 계산에서 빠지는 배치</small></div>
          <div className="kpi"><span>편중 월</span><strong className={analysis.skewedMonths > 0 ? "critical" : undefined}>{fmt(analysis.skewedMonths)}/{months.length}개월</strong><small>담당자 간 부하 편차(변동계수) {NORMAL_CV} 초과</small></div>
          <div className="kpi"><span>시작 집중 월</span><strong>{analysis.peakStartMonth}</strong><small>전체 시작의 {pct(analysis.peakStartShare)}가 이 달에 시작</small></div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>월별 배치 추이</h2><span>{months.length}개월</span></div>
          <div className="table-wrap"><table>
            <thead><tr><th>월</th><th data-numeric>영업일</th><th data-numeric>시작</th><th data-numeric>종료</th><th data-numeric>진행 Task</th><th data-numeric>배치 인원</th><th data-numeric>인당 부하</th><th>인당 부하 추이</th><th data-numeric>중앙값</th><th data-numeric>최대</th><th data-numeric>미지정</th><th>균형</th></tr></thead>
            <tbody>{timeline.map((row) => { const [tone, text] = BALANCE_BADGE[row.balance]; return <tr key={row.month}>
              <td>{row.month}</td>
              <td data-numeric>{row.businessDays}</td>
              <td data-numeric>{fmt(row.started)}</td>
              <td data-numeric>{fmt(row.ended)}</td>
              <td data-numeric>{fmt(row.active)}</td>
              <td data-numeric>{fmt(row.owners)}명</td>
              <td data-numeric>{load(row.perOwner)}</td>
              <td><span className="load-bar"><i style={{ width: `${maxPerOwner ? (row.perOwner / maxPerOwner) * 100 : 0}%` }} /></span></td>
              <td data-numeric>{load(row.median)}</td>
              <td data-numeric>{load(row.max)}</td>
              <td data-numeric>{row.unassignedActive ? fmt(row.unassignedActive) : "-"}</td>
              <td><span className={`badge ${tone}`}>{text}</span></td>
            </tr>; })}</tbody>
          </table></div>
          <p className="matrix-note">부하 = 한 달 동안 한 사람이 평균 몇 건을 동시에 진행하는가(계획 Task가 걸친 영업일 합 ÷ 그 달 영업일, 주말만 제외). 인당 부하가 일정하고 균형 판정이 이어지면 배분이 고른 것이고, 특정 달만 치솟거나 시작·종료 건수가 한 달에 몰리면 착수·마감 집중을 의심합니다.</p>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>업무그룹별 인당 부하</h2><span>{groups.length}개 그룹</span></div>
          <div className="table-wrap"><table>
            <thead><tr><th>업무그룹</th><th data-numeric>인원</th><th data-numeric>Task</th>{months.map((month) => <th key={month} data-numeric>{monthLabel(month)}</th>)}<th data-numeric>최대</th></tr></thead>
            <tbody>{groups.map((group) => <tr key={group.groupLabel}>
              <td><Link className="table-link" href={`${basePath}/workload?group=${encodeURIComponent(group.groupLabel)}`}>{group.groupLabel}</Link></td>
              <td data-numeric>{fmt(group.owners)}명</td>
              <td data-numeric>{fmt(group.tasks)}건</td>
              {group.loads.map((value, index) => <td key={months[index]} className={`load-cell ${value <= 0 ? "empty" : levelClass(groupLevel(value, index))}`}>{load(value)}</td>)}
              <td data-numeric>{load(group.peak)}{group.peakMonth ? <small> ({monthLabel(group.peakMonth)})</small> : null}</td>
            </tr>)}</tbody>
          </table></div>
          <p className="matrix-note">셀 = 그 달 부하가 있는 그룹원의 평균 부하. 빨강은 그 달 전체 인당 부하의 {HEAVY_RATIO}배 이상, 파랑은 {LIGHT_RATIO}배 이하입니다.</p>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>담당자별 월 부하</h2><span>{owners.length}명</span></div>
          <div className="table-wrap"><table>
            <thead><tr><th>담당자</th><th>업무그룹</th><th data-numeric>Task</th>{months.map((month) => <th key={month} data-numeric>{monthLabel(month)}</th>)}<th data-numeric>최대</th><th data-numeric>과다 월</th><th data-numeric>여유 월</th><th data-numeric>공백 월</th></tr></thead>
            <tbody>{owners.map((owner) => <tr key={owner.ownerKey}>
              <td><Link className="table-link" href={`${basePath}/workload?owner=${encodeURIComponent(owner.ownerKey)}`}>{owner.ownerName}</Link></td>
              <td>{owner.groupLabel}</td>
              <td data-numeric>{fmt(owner.tasks)}건</td>
              {owner.loads.map((value, index) => <td key={months[index]} className={`load-cell ${value <= 0 ? "empty" : levelClass(owner.levels[index])}`}>{load(value)}</td>)}
              <td data-numeric>{load(owner.peak)}</td>
              <td data-numeric>{owner.heavyMonths ? <span className="badge band-red">{owner.heavyMonths}</span> : "-"}</td>
              <td data-numeric>{owner.lightMonths ? <span className="badge band-blue">{owner.lightMonths}</span> : "-"}</td>
              <td data-numeric>{owner.gapMonths ? <span className="badge band-yellow">{owner.gapMonths}</span> : "-"}</td>
            </tr>)}</tbody>
          </table></div>
          <p className="matrix-note">과다 = 그 달 부하가 배치 담당자 중앙값의 {HEAVY_RATIO}배 이상, 여유 = {LIGHT_RATIO}배 이하(균형 판정: 변동계수 {BALANCED_CV} 이하 균형, {NORMAL_CV} 이하 보통). 공백 월 = 첫 배치와 마지막 배치 사이에 배치가 끊긴 달입니다. 계획 일정만으로 본 값이며 Task별 공수·난이도는 반영하지 않으므로 재배치 논의의 근거로만 사용하세요.</p>
        </section>
      </>}
    </div>
  </>;
}

const LEVEL_BADGE = { heavy: ["band-red", "과다"], normal: ["band-green", "적정"], light: ["band-blue", "여유"] } as const;

/** 인당부하 상세 — 업무그룹 또는 담당자 한 곳의 월별 부하와 소속 WBS Task 현황. */
export function WbsWorkloadDetailScreen({ analysis, basePath, group, owner, tasks }: {
  analysis: WorkloadAnalysis; basePath: string; group?: WorkloadGroupRow; owner?: WorkloadOwnerRow; tasks: WorkloadTask[];
}) {
  const { months, timeline } = analysis;
  const target = (group ?? owner)!;
  const title = group ? group.groupLabel : owner!.ownerName;
  const loads = target.loads;
  // 판정 기준 — 업무그룹은 그 달 전체 인당 부하, 담당자는 그 달 배치 담당자 중앙값(인당부하 표와 같은 기준).
  const baseline = timeline.map((row) => (group ? row.perOwner : row.median));
  const levels: (WorkloadLevel | null)[] = group
    ? loads.map((value, index) => (value <= 0 ? null : baseline[index] > 0 && value >= baseline[index] * HEAVY_RATIO ? "heavy" : baseline[index] > 0 && value <= baseline[index] * LIGHT_RATIO ? "light" : "normal"))
    : owner!.levels;
  const active = loads.filter((value) => value > 0);
  const average = active.length ? active.reduce((sum, value) => sum + value, 0) / active.length : 0;
  const heavy = levels.filter((level) => level === "heavy").length;
  const light = levels.filter((level) => level === "light").length;
  const scale = Math.max(0.01, ...loads, ...baseline) * 1.15;
  const y = (value: number) => (value / scale) * 100;
  const baselineName = group ? "전체 인당 부하" : "배치 담당자 중앙값";
  return <>
    <Header title={`${title} 인당 부하`} tip={LOAD_TIP} description={group ? "업무그룹의 월별 부하와 소속 WBS Task 현황" : `${owner!.groupLabel} · 담당자의 월별 부하와 담당 WBS Task 현황`} />
    <div className="content">
      <div className="panel-head"><Link className="table-link" href={`${basePath}/workload`}>← 인당부하 분석으로</Link>{owner ? <Link className="table-link" href={`${basePath}/workload?group=${encodeURIComponent(owner.groupLabel)}`}>업무그룹 {owner.groupLabel} 보기</Link> : null}</div>
      <section className="kpi-grid kpi-grid-6">
        {group ? <div className="kpi"><span>인원</span><strong>{fmt(group.owners)}명</strong><small>부하가 있는 담당자</small></div> : <div className="kpi"><span>공백 월</span><strong>{owner!.gapMonths ? fmt(owner!.gapMonths) : "-"}</strong><small>첫~마지막 배치 사이 끊긴 달</small></div>}
        <div className="kpi"><span>Task</span><strong>{fmt(target.tasks)}건</strong><small>{group ? "업무그룹 소속 전체" : "담당 전체"}</small></div>
        <div className="kpi"><span>최대 부하</span><strong>{load(target.peak)}</strong><small>{target.peakMonth ?? "-"}</small></div>
        <div className="kpi"><span>평균 부하</span><strong>{load(average)}</strong><small>부하가 있는 {active.length}개월 평균</small></div>
        <div className="kpi"><span>과다 월</span><strong className={heavy > 0 ? "critical" : undefined}>{heavy || "-"}</strong><small>비교값의 {HEAVY_RATIO}배 이상</small></div>
        <div className="kpi"><span>여유 월</span><strong>{light || "-"}</strong><small>비교값의 {LIGHT_RATIO}배 이하</small></div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>월별 부하</h2><span>{months[0]} ~ {months[months.length - 1]} · 선 = {baselineName}</span></div>
        <div className="month-chart" role="img" aria-label={`월별 부하: ${months.map((month, index) => `${month} ${load(loads[index])}`).join(", ")}`}>
          <div className="month-chart-inner">
            <div className="month-chart-plot">
              {months.map((month, index) => <div className="month-chart-col" key={month} title={`${month} · 부하 ${load(loads[index])} · ${baselineName} ${load(baseline[index])}`}>
                <div className="month-chart-bar" style={{ height: `${y(loads[index])}%` }}>{loads[index] > 0 ? <i className={levels[index] ?? "normal"} style={{ flexGrow: 1 }} /> : null}</div>
                <span className="month-chart-total" style={{ bottom: `${y(loads[index])}%` }}>{loads[index] > 0 ? loads[index].toFixed(1) : ""}</span>
              </div>)}
              <svg className="month-chart-trend" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline vectorEffect="non-scaling-stroke" points={baseline.map((value, index) => `${((index + 0.5) / months.length) * 100},${100 - y(value)}`).join(" ")} />
              </svg>
            </div>
            <div className="month-chart-axis">{months.map((month) => <span key={month}>{monthLabel(month)}</span>)}</div>
          </div>
        </div>
        <div className="month-chart-legend"><span><i className="heavy" />과다</span><span><i className="normal" />적정</span><span><i className="light" />여유</span><span><i className="trend" />{baselineName}</span></div>
        <div className="table-wrap"><table>
          <thead><tr><th>월</th><th data-numeric>부하</th><th data-numeric>{baselineName}</th><th>판정</th></tr></thead>
          <tbody>{months.map((month, index) => { const level = levels[index]; return <tr key={month}>
            <td>{month}</td>
            <td data-numeric>{load(loads[index])}</td>
            <td data-numeric>{load(baseline[index])}</td>
            <td>{level ? <span className={`badge ${LEVEL_BADGE[level][0]}`}>{LEVEL_BADGE[level][1]}</span> : "-"}</td>
          </tr>; })}</tbody>
        </table></div>
        <p className="matrix-note">부하 = 그 달 {group ? "그룹원의 평균" : "한 사람"}이 평균 몇 건을 동시에 진행하는가(계획 영업일 기준). 과다·여유는 {baselineName} 대비 {HEAVY_RATIO}배 이상, {LIGHT_RATIO}배 이하입니다.</p>
      </section>

      <TaskStatusPanel tasks={tasks} asOf={analysis.asOf} showOwner={!!group} />
    </div>
  </>;
}
