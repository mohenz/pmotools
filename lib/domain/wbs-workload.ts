// WBS 배치량 분석 — 프로젝트 초기~종료까지 계획 일정만으로 월별 Task 배치량과 담당자 간 편중을 계산한다.
// DB/런타임 의존이 없는 순수 함수라 도메인 계층에 둔다. 공휴일은 반영하지 않고 주말만 제외한다.

export type WorkloadTask = {
  ownerKey: string | null;
  ownerName: string | null;
  groupLabel: string;
  groupOrder?: string; // 업무그룹 정렬 키(작을수록 앞) — 없으면 맨 뒤
  startDate: string | null;
  dueDate: string | null;
  completed: boolean;
  actualDueDate: string | null;
};

// 산출 지표 — 기준일(asOf)까지 도래한 배치 대비 얼마나 끝냈는가. 공수 데이터가 없어 건수와 계획 영업일 두 가지로 센다.
export type WorkloadGrade = "A" | "B" | "C" | "D";
export type WorkloadPerf = {
  assigned: number; // 배치 Task
  due: number; // 계획 종료일이 기준일까지 도래한 Task
  dueDone: number; // 그중 완료
  done: number; // 완료 전체
  overdue: number; // 기한이 지났는데 미완료
  doneOnTime: number; // 실적 종료일이 계획 종료일 이내
  doneDated: number; // 실적 종료일이 있는 완료
  dueRate: number | null; // 처리율 = dueDone ÷ due
  onTimeRate: number | null; // 정시 완료율 = doneOnTime ÷ doneDated
  dayRate: number | null; // 영업일 가중 처리율
  throughput: number | null; // 부하 1건당 월 처리 건수 = 완료 ÷ (기준일까지 월 부하 합)
  grade: WorkloadGrade; // 표본 등급(도래 건수 기준)
};
/** 표본 등급 경계 — 도래한 Task가 이 건수 이상이면 A/B, 1건 이상이면 C, 없으면 D(비교 불가). */
export const GRADE_A_MIN = 10;
export const GRADE_B_MIN = 5;

/** 생산성 평가 경계 — 처리율이 HIGH_MIN 이상이면 상, MID_MIN 이상이면 중, 미만이면 하. 표본 등급이 C·D면 평가하지 않는다(null). */
export const RATING_HIGH_MIN = 0.95;
export const RATING_MID_MIN = 0.8;
export type WorkloadRating = "high" | "mid" | "low";
export function rateProductivity(perf: Pick<WorkloadPerf, "dueRate" | "grade">): WorkloadRating | null {
  if (perf.dueRate === null || (perf.grade !== "A" && perf.grade !== "B")) return null;
  return perf.dueRate >= RATING_HIGH_MIN ? "high" : perf.dueRate >= RATING_MID_MIN ? "mid" : "low";
}

// 부하 = 한 달 동안 담당자가 평균 몇 건을 동시에 진행하는가(계획 Task가 걸친 영업일 합 ÷ 해당 월 영업일).
export type WorkloadLevel = "heavy" | "normal" | "light";

/** 담당자 월 부하가 그 달 배치된 담당자 중앙값의 몇 배 이상/이하이면 과다·여유로 볼지. */
export const HEAVY_RATIO = 1.5;
export const LIGHT_RATIO = 0.5;
/** 편중도(변동계수) 판정 경계 — 이하 균형, 이하 보통, 초과 편중. */
export const BALANCED_CV = 0.5;
export const NORMAL_CV = 1.0;

export type WorkloadMonth = {
  month: string; // YYYY-MM
  businessDays: number;
  started: number; // 계획 시작 건수
  ended: number; // 계획 종료 건수
  active: number; // 그 달 걸친 Task 수
  owners: number; // 부하가 있는 담당자 수
  unassignedActive: number; // 담당자 없이 걸친 Task 수
  totalLoad: number; // 담당자 부하 합 = 평균 동시 진행 건수
  perOwner: number; // 인당 평균 부하
  median: number; // 담당자 부하 중앙값
  max: number;
  cv: number; // 변동계수(표준편차 ÷ 평균) — 클수록 편중
  balance: "balanced" | "normal" | "skewed";
};

export type WorkloadGroupRow = {
  groupLabel: string;
  owners: number;
  tasks: number;
  loads: number[]; // months와 같은 순서, 인당 평균 부하
  peak: number;
  peakMonth: string | null;
  perf: WorkloadPerf;
  rateMin: number | null; // 표본 A·B 담당자 2명 이상일 때 처리율 최저/최고
  rateMax: number | null;
  rateCount: number;
};

export type WorkloadOwnerRow = {
  ownerKey: string;
  ownerName: string;
  groupLabel: string;
  tasks: number;
  perf: WorkloadPerf;
  pastLoad: number; // 기준일이 속한 달까지의 월 부하 합
  loads: number[]; // months와 같은 순서
  levels: (WorkloadLevel | null)[]; // 부하가 없으면 null
  peak: number;
  peakMonth: string | null;
  heavyMonths: number;
  lightMonths: number;
  gapMonths: number; // 첫 배치~마지막 배치 사이에 배치가 끊긴 월 수
};

export type WorkloadAnalysis = {
  asOf: string; // 산출 지표 기준일
  perf: WorkloadPerf; // 담당자 미지정 포함 전체
  months: string[];
  rangeStart: string | null;
  rangeEnd: string | null;
  totalTasks: number; // 분석 대상(일정이 있는) Task
  excludedTasks: number; // 일정 미입력으로 제외
  unassignedTasks: number;
  timeline: WorkloadMonth[];
  groups: WorkloadGroupRow[];
  owners: WorkloadOwnerRow[];
  peakStartMonth: string | null; // 시작이 가장 몰린 달
  peakStartShare: number; // 그 달의 시작 건수 ÷ 전체
  skewedMonths: number;
};

const monthOf = (isoDate: string) => isoDate.slice(0, 7);
const isWeekend = (date: Date) => date.getUTCDay() === 0 || date.getUTCDay() === 6;
const parse = (isoDate: string) => new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);

function monthsBetween(first: string, last: string): string[] {
  const months: string[] = [];
  let [year, month] = first.split("-").map(Number);
  const [lastYear, lastMonth] = last.split("-").map(Number);
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return months;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

type PerfAcc = { assigned: number; due: number; dueDone: number; done: number; overdue: number; doneOnTime: number; doneDated: number; dueDays: number; dueDoneDays: number };
const newAcc = (): PerfAcc => ({ assigned: 0, due: 0, dueDone: 0, done: 0, overdue: 0, doneOnTime: 0, doneDated: 0, dueDays: 0, dueDoneDays: 0 });
const mergeAcc = (into: PerfAcc, from: PerfAcc) => { for (const key of Object.keys(into) as (keyof PerfAcc)[]) into[key] += from[key]; };

function addToAcc(acc: PerfAcc, task: WorkloadTask & { dueDate: string }, businessDaysOfTask: number, asOf: string) {
  acc.assigned += 1;
  const isDue = task.dueDate <= asOf;
  if (isDue) { acc.due += 1; acc.dueDays += businessDaysOfTask; }
  if (task.completed) {
    acc.done += 1;
    if (isDue) { acc.dueDone += 1; acc.dueDoneDays += businessDaysOfTask; }
    if (task.actualDueDate) { acc.doneDated += 1; if (task.actualDueDate <= task.dueDate) acc.doneOnTime += 1; }
  } else if (task.dueDate < asOf) {
    acc.overdue += 1;
  }
}

function finishPerf(acc: PerfAcc, pastLoadMonths: number): WorkloadPerf {
  return {
    assigned: acc.assigned, due: acc.due, dueDone: acc.dueDone, done: acc.done, overdue: acc.overdue, doneOnTime: acc.doneOnTime, doneDated: acc.doneDated,
    dueRate: acc.due ? acc.dueDone / acc.due : null,
    onTimeRate: acc.doneDated ? acc.doneOnTime / acc.doneDated : null,
    dayRate: acc.dueDays ? acc.dueDoneDays / acc.dueDays : null,
    throughput: pastLoadMonths > 0 ? round2(acc.done / pastLoadMonths) : null,
    grade: acc.due >= GRADE_A_MIN ? "A" : acc.due >= GRADE_B_MIN ? "B" : acc.due >= 1 ? "C" : "D",
  };
}

export function analyzeWorkload(tasks: WorkloadTask[], asOf: string = new Date().toISOString().slice(0, 10)): WorkloadAnalysis {
  const dated = tasks.filter((task): task is WorkloadTask & { startDate: string; dueDate: string } => !!task.startDate && !!task.dueDate && task.dueDate >= task.startDate);
  const excludedTasks = tasks.length - dated.length;
  const empty: WorkloadAnalysis = { asOf, months: [], rangeStart: null, rangeEnd: null, totalTasks: 0, excludedTasks, unassignedTasks: 0, timeline: [], groups: [], owners: [], peakStartMonth: null, peakStartShare: 0, skewedMonths: 0, perf: finishPerf(newAcc(), 0) };
  if (!dated.length) return empty;

  const rangeStart = dated.reduce((min, task) => (task.startDate < min ? task.startDate : min), dated[0].startDate);
  const rangeEnd = dated.reduce((max, task) => (task.dueDate > max ? task.dueDate : max), dated[0].dueDate);
  const months = monthsBetween(monthOf(rangeStart), monthOf(rangeEnd));
  const monthIndex = new Map(months.map((month, index) => [month, index]));

  // 월별 영업일 수 — 프로젝트 전체 기간 한 번만 센다.
  const businessDays = months.map(() => 0);
  for (let cursor = parse(`${months[0]}-01`), end = parse(rangeEnd); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (!isWeekend(cursor)) businessDays[monthIndex.get(cursor.toISOString().slice(0, 7))!] += 1;
  }

  const started = months.map(() => 0);
  const ended = months.map(() => 0);
  const active = months.map(() => 0);
  const unassignedActive = months.map(() => 0);
  const ownerDays = new Map<string, number[]>(); // 담당자 → 월별 Task 영업일 합
  const ownerMeta = new Map<string, { name: string; group: string; order: string; tasks: number }>();
  const ownerAcc = new Map<string, PerfAcc>();
  const overallAcc = newAcc();
  let unassignedTasks = 0;

  for (const task of dated) {
    started[monthIndex.get(monthOf(task.startDate))!] += 1;
    ended[monthIndex.get(monthOf(task.dueDate))!] += 1;
    const days = months.map(() => 0);
    // 주말만 걸친 Task도 걸친 달에는 포함시키되 부하는 0이 된다.
    const touched = new Set<number>();
    for (let cursor = parse(task.startDate), end = parse(task.dueDate); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const index = monthIndex.get(cursor.toISOString().slice(0, 7))!;
      touched.add(index);
      if (!isWeekend(cursor)) days[index] += 1;
    }
    for (const index of touched) {
      active[index] += 1;
      if (!task.ownerKey) unassignedActive[index] += 1;
    }
    const taskDays = days.reduce((sum, value) => sum + value, 0);
    addToAcc(overallAcc, task, taskDays, asOf);
    if (!task.ownerKey) { unassignedTasks += 1; continue; }
    const acc = ownerAcc.get(task.ownerKey) ?? newAcc();
    addToAcc(acc, task, taskDays, asOf);
    ownerAcc.set(task.ownerKey, acc);
    const row = ownerDays.get(task.ownerKey) ?? months.map(() => 0);
    days.forEach((value, index) => { row[index] += value; });
    ownerDays.set(task.ownerKey, row);
    const meta = ownerMeta.get(task.ownerKey) ?? { name: task.ownerName ?? "(이름 없음)", group: task.groupLabel, order: task.groupOrder ?? "￿", tasks: 0 };
    meta.tasks += 1;
    ownerMeta.set(task.ownerKey, meta);
  }

  const ownerLoads = new Map<string, number[]>();
  for (const [key, row] of ownerDays) ownerLoads.set(key, row.map((value, index) => (businessDays[index] ? round2(value / businessDays[index]) : 0)));

  const timeline: WorkloadMonth[] = months.map((month, index) => {
    const loads = [...ownerLoads.values()].map((row) => row[index]).filter((value) => value > 0);
    const totalLoad = loads.reduce((sum, value) => sum + value, 0);
    const cv = coefficientOfVariation(loads);
    return {
      month, businessDays: businessDays[index], started: started[index], ended: ended[index], active: active[index],
      owners: loads.length, unassignedActive: unassignedActive[index], totalLoad: round2(totalLoad),
      perOwner: loads.length ? round2(totalLoad / loads.length) : 0, median: round2(median(loads)), max: loads.length ? Math.max(...loads) : 0,
      cv: round2(cv), balance: cv <= BALANCED_CV ? "balanced" : cv <= NORMAL_CV ? "normal" : "skewed",
    };
  });

  // 기준일이 속한 달까지의 월 부하 합 — 부하 1건당 처리량의 분모. 기준일이 있는 달은 그 달 전체 부하를 쓴다.
  const asOfMonth = monthOf(asOf);
  const pastLoadOf = (loads: number[]) => loads.reduce((sum, value, index) => (months[index] <= asOfMonth ? sum + value : sum), 0);
  const owners: WorkloadOwnerRow[] = [...ownerLoads.entries()].map(([ownerKey, loads]) => {
    const meta = ownerMeta.get(ownerKey)!;
    const levels = loads.map((value, index): WorkloadLevel | null => {
      if (value <= 0) return null;
      const mid = timeline[index].median;
      if (mid > 0 && value >= mid * HEAVY_RATIO) return "heavy";
      if (mid > 0 && value <= mid * LIGHT_RATIO) return "light";
      return "normal";
    });
    const first = loads.findIndex((value) => value > 0);
    const last = loads.length - 1 - [...loads].reverse().findIndex((value) => value > 0);
    const peak = Math.max(...loads);
    const pastLoad = pastLoadOf(loads);
    return {
      ownerKey, ownerName: meta.name, groupLabel: meta.group, tasks: meta.tasks, loads, levels, peak,
      perf: finishPerf(ownerAcc.get(ownerKey)!, pastLoad), pastLoad,
      peakMonth: peak > 0 ? months[loads.indexOf(peak)] : null,
      heavyMonths: levels.filter((level) => level === "heavy").length,
      lightMonths: levels.filter((level) => level === "light").length,
      gapMonths: loads.slice(first, last + 1).filter((value) => value <= 0).length,
    };
  });
  // 업무그룹은 groupOrder(프로젝트 순서·그룹 코드 순서) → 라벨 순으로, 같은 그룹 안에서는 이름순으로 묶는다.
  const orderOf = (owner: WorkloadOwnerRow) => ownerMeta.get(owner.ownerKey)!.order;
  owners.sort((a, b) => orderOf(a).localeCompare(orderOf(b)) || a.groupLabel.localeCompare(b.groupLabel, "ko") || a.ownerName.localeCompare(b.ownerName, "ko"));

  const groupLabels = [...new Set(owners.map((owner) => owner.groupLabel))];
  const groups: WorkloadGroupRow[] = groupLabels.map((groupLabel) => {
    const members = owners.filter((owner) => owner.groupLabel === groupLabel);
    const loads = months.map((_, index) => {
      const present = members.map((member) => member.loads[index]).filter((value) => value > 0);
      return present.length ? round2(present.reduce((sum, value) => sum + value, 0) / present.length) : 0;
    });
    const peak = Math.max(...loads);
    const acc = newAcc();
    for (const member of members) mergeAcc(acc, ownerAcc.get(member.ownerKey)!);
    // 그룹 내 처리율 편차 — 표본이 충분한(A·B) 담당자끼리만 비교한다.
    const rates = members.filter((member) => member.perf.grade === "A" || member.perf.grade === "B").map((member) => member.perf.dueRate).filter((rate): rate is number => rate !== null);
    return {
      groupLabel, owners: members.length, tasks: members.reduce((sum, member) => sum + member.tasks, 0), loads, peak, peakMonth: peak > 0 ? months[loads.indexOf(peak)] : null,
      perf: finishPerf(acc, members.reduce((sum, member) => sum + member.pastLoad, 0)),
      rateMin: rates.length >= 2 ? Math.min(...rates) : null, rateMax: rates.length >= 2 ? Math.max(...rates) : null, rateCount: rates.length,
    };
  });

  const peakStart = Math.max(...started);
  return {
    asOf, perf: finishPerf(overallAcc, owners.reduce((sum, owner) => sum + owner.pastLoad, 0)),
    months, rangeStart, rangeEnd, totalTasks: dated.length, excludedTasks, unassignedTasks, timeline, groups, owners,
    peakStartMonth: months[started.indexOf(peakStart)], peakStartShare: round2(peakStart / dated.length),
    skewedMonths: timeline.filter((row) => row.balance === "skewed").length,
  };
}
