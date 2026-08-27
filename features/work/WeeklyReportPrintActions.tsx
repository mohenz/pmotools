"use client";

import { useEffect } from "react";
import Link from "next/link";

export function WeeklyReportPrintActions({ autoPrint }: { autoPrint: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return <div className="print-report-actions">
    <Link className="button secondary" href="/weekly-reports">목록으로</Link>
    <button className="button primary" type="button" onClick={() => window.print()}>PDF로 저장</button>
  </div>;
}
