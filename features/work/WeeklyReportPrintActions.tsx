"use client";

import { useEffect } from "react";
import Link from "next/link";

export function WeeklyReportPrintActions({ autoPrint, weekId }: { autoPrint: boolean; weekId?: string }) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return <div className="print-report-actions">
    <Link className="button secondary" href={weekId ? `/weekly-reports/${weekId}` : "/weekly-reports"}>{weekId ? "리포트로 돌아가기" : "목록으로"}</Link>
    <button className="button primary" type="button" onClick={() => window.print()}>PDF로 저장</button>
  </div>;
}
