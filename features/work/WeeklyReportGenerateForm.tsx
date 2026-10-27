"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateWeeklyReportPeriod } from "@/lib/domain/weekly-reports";
import { WarningDialog } from "@/components/WarningDialog";

const messageOf = (payload: unknown) => {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: string } }).error;
    if (error?.message) return error.message;
  }
  return "요청 처리 중 오류가 발생했습니다.";
};

export type TargetModuleItem = {
  id: string;
  code: string;
  label: string;
  color: string | null;
  sortOrder: number;
};

export type WeeklyReportTargetInfo = {
  rootProjectId: string;
  isRoot: boolean;
  modules: TargetModuleItem[];
  missingInRootLabels: string[];
};

export function WeeklyReportGenerateForm({
  defaultYear,
  defaultMonth,
  defaultWeek,
  targetInfo,
}: {
  defaultYear: number;
  defaultMonth: number;
  defaultWeek: number;
  targetInfo?: WeeklyReportTargetInfo;
}) {
  const router = useRouter();
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [weekOfMonth, setWeekOfMonth] = useState(defaultWeek);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const period = useMemo(() => {
    try { return calculateWeeklyReportPeriod(year, month, weekOfMonth); }
    catch { return null; }
  }, [year, month, weekOfMonth]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    try {
      const response = await fetch("/api/v1/weekly-reports/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year, month, weekOfMonth }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(messageOf(payload));
      router.push(`/weekly-reports/${payload.data.id}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "리포트를 생성하지 못했습니다.");
    } finally { setPending(false); }
  }

  return <form className="weekly-generate-form" onSubmit={submit}>
    <div className="weekly-generate-fields">
      <label>연도<input type="number" min={2000} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value))} /></label>
      <label>월<select value={month} onChange={(event) => setMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}월</option>)}</select></label>
      <label>주차<select value={weekOfMonth} onChange={(event) => setWeekOfMonth(Number(event.target.value))}>{Array.from({ length: 5 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}주</option>)}</select></label>
      <button className="button primary" disabled={pending || !period}>{pending ? "생성 중…" : "위클리 리포트 생성"}</button>
    </div>

    {targetInfo && (
      <div className="weekly-target-preview">
        <div className="weekly-target-header">
          <span className="weekly-target-badge">
            생성 대상: 총 <strong>{targetInfo.modules.length}</strong>개 업무그룹
          </span>
          {targetInfo.missingInRootLabels && targetInfo.missingInRootLabels.length > 0 && (
            <span className="weekly-target-warning">
              ⚠️ 상위 프로젝트 누락 {targetInfo.missingInRootLabels.length}개 트랙 제외됨 ({targetInfo.missingInRootLabels.join(", ")})
            </span>
          )}
        </div>
        <div className="weekly-target-chips">
          {targetInfo.modules.map((m, index) => (
            <span key={m.id} className="weekly-target-chip" style={m.color ? { borderLeftColor: m.color } : undefined} title={`${m.code}: ${m.label}`}>
              <span className="chip-num">{index + 1}</span>
              <span className="chip-label">{m.label}</span>
            </span>
          ))}
        </div>
      </div>
    )}

    {period ? <div className="weekly-period-preview"><span><b>실적 기간</b>{period.actualStart} ~ {period.actualEnd}</span><span><b>계획 기간</b>{period.planStart} ~ {period.planEnd}</span></div> : <p className="form-error">선택한 월에는 해당 주차가 없습니다.</p>}
    <WarningDialog message={message} onClose={() => setMessage("")} />
  </form>;
}
