"use client";

import { useEffect } from "react";
import Link from "next/link";

// 브라우저 "PDF로 저장"의 기본 파일명은 문서 제목을 따르므로, 인쇄 화면에서만 제목을 양식 파일명(EOCP_YYYYMMDD_분류_안건)으로 바꾼다.
export function MeetingMinutePrintActions({ minuteId, fileName, autoPrint }: { minuteId: string; fileName: string; autoPrint: boolean }) {
  useEffect(() => {
    const previous = document.title;
    document.title = fileName;
    const timer = autoPrint ? window.setTimeout(() => window.print(), 250) : undefined;
    return () => { document.title = previous; if (timer) window.clearTimeout(timer); };
  }, [fileName, autoPrint]);

  return <div className="print-report-actions">
    <Link className="button secondary" href={`/meeting-minutes/${minuteId}`}>회의록으로 돌아가기</Link>
    <button className="button primary" type="button" onClick={() => window.print()}>PDF로 저장</button>
  </div>;
}
