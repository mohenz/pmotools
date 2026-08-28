"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WeeklyReportDetail } from "@/lib/server/work-management";

type Report = WeeklyReportDetail["reports"][number];

export function WeeklyReportFormScreen({ reportName, report }: { reportName: string; report: Report }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const hasContent = Boolean(report.achievements.trim() || report.nextPlan.trim() || report.issues.trim());
  const mode = report.canEdit ? (hasContent ? "수정" : "작성") : "조회";
  const detailHref = `/weekly-reports/${report.weekId}`;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!report.canEdit) return;
    const form = new FormData(event.currentTarget);
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/v1/weekly-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekId: report.weekId,
          areaCodeId: report.areaCodeId,
          achievements: String(form.get("achievements") ?? ""),
          nextPlan: String(form.get("nextPlan") ?? ""),
          issues: String(form.get("issues") ?? ""),
          decisions: report.decisions,
          notes: report.notes,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? "저장하지 못했습니다.");
      router.push(detailHref);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
      setPending(false);
    }
  }

  return <>
    <header className="topbar weekly-report-form-topbar"><div className="weekly-report-form-heading"><h1>{report.areaLabel} 위클리리포트 {mode}</h1><p>{reportName} · 각 항목은 최대 2,000자까지 입력할 수 있습니다.</p></div><Link className="button secondary weekly-report-form-back" href={detailHref}>상세 화면으로</Link></header>
    <div className="content weekly-report-form-content">
      <section className="panel form-panel weekly-report-page-form">
        <form className="weekly-report-edit-form" onSubmit={save}>
          <label className="weekly-report-field"><span>실적</span><textarea name="achievements" rows={10} maxLength={2000} defaultValue={report.achievements} readOnly={!report.canEdit} /></label>
          <label className="weekly-report-field"><span>계획</span><textarea name="nextPlan" rows={10} maxLength={2000} defaultValue={report.nextPlan} readOnly={!report.canEdit} /></label>
          <label className="weekly-report-field weekly-report-field-wide"><span>이슈 및 요청사항</span><textarea name="issues" rows={7} maxLength={2000} defaultValue={report.issues} readOnly={!report.canEdit} /></label>
          {message && <p className="form-error" role="alert">{message}</p>}
          <div className="form-actions"><Link className="button secondary" href={detailHref}>{report.canEdit ? "취소" : "돌아가기"}</Link>{report.canEdit && <button className="button primary" type="submit" disabled={pending}>{pending ? "저장 중…" : "저장"}</button>}</div>
        </form>
      </section>
    </div>
  </>;
}
