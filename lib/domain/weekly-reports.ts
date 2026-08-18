export type WeeklyReportPeriod = {
  year: number;
  month: number;
  weekOfMonth: number;
  weekKey: string;
  label: string;
  actualStart: string;
  actualEnd: string;
  planStart: string;
  planEnd: string;
};

const iso = (date: Date) => date.toISOString().slice(0, 10);

export function weeklyReportName(weekLabel: string, projectName: string) {
  const reportProjectName = projectName.replace(/\s+CONTROL$/i, "").trim();
  return `${weekLabel} ${reportProjectName || projectName.trim()} 위클리 리포트`;
}

export function calculateWeeklyReportPeriod(year: number, month: number, weekOfMonth: number): WeeklyReportPeriod {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("연도는 2000~2100 사이여야 합니다.");
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("월은 1~12 사이여야 합니다.");
  if (!Number.isInteger(weekOfMonth) || weekOfMonth < 1 || weekOfMonth > 5) throw new Error("주차는 1~5 사이여야 합니다.");

  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysToMonday = (8 - first.getUTCDay()) % 7;
  const planStartDate = new Date(first);
  planStartDate.setUTCDate(first.getUTCDate() + daysToMonday + (weekOfMonth - 1) * 7);
  if (planStartDate.getUTCMonth() !== month - 1) throw new Error(`${month}월에는 ${weekOfMonth}주가 없습니다.`);

  const planEndDate = new Date(planStartDate);
  planEndDate.setUTCDate(planStartDate.getUTCDate() + 4);
  const actualStartDate = new Date(planStartDate);
  actualStartDate.setUTCDate(planStartDate.getUTCDate() - 7);
  const actualEndDate = new Date(planStartDate);
  actualEndDate.setUTCDate(planStartDate.getUTCDate() - 3);

  return {
    year,
    month,
    weekOfMonth,
    weekKey: `${year}-${String(month).padStart(2, "0")}-W${weekOfMonth}`,
    label: `${year}년 ${month}월 ${weekOfMonth}주`,
    actualStart: iso(actualStartDate),
    actualEnd: iso(actualEndDate),
    planStart: iso(planStartDate),
    planEnd: iso(planEndDate),
  };
}

export function inferWeekOfMonth(startDate: string) {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const firstMonday = 1 + ((8 - first.getUTCDay()) % 7);
  return Math.max(1, Math.floor((date.getUTCDate() - firstMonday) / 7) + 1);
}
