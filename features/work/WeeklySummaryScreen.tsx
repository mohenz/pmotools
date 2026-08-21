"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { parseSummarySections } from "@/lib/domain/weekly-report-summary";
import type { WeeklySummaryRecord } from "@/lib/server/weekly-report-summary";

export function WeeklySummaryScreen({ weekId, initialSummary, canGenerate }: { weekId: string; initialSummary: WeeklySummaryRecord | null; canGenerate: boolean }) {
  const [summary, setSummary] = useState(initialSummary);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [printOpen, setPrintOpen] = useState(false);

  async function generate() {
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/v1/weekly-reports/${weekId}/summary`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? "요약을 생성하지 못했습니다.");
      setSummary(payload.data);
    } catch (e) { setError(e instanceof Error ? e.message : "요약을 생성하지 못했습니다."); }
    finally { setPending(false); }
  }

  return <>
    <section className="panel weekly-summary-screen">
      <div className="panel-head">
        <h2>AI 요약</h2>
        <div className="weekly-summary-screen-actions">
          {summary && <button className="button secondary small" type="button" onClick={() => setPrintOpen(true)}>인쇄보기</button>}
          {canGenerate && <button className="button primary small" type="button" disabled={pending} onClick={generate}>{pending ? "생성 중…" : summary ? "다시요약" : "요약하기"}</button>}
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      {summary
        ? <>
          {summary.stale && <p className="weekly-summary-stale">리포트가 수정되어 요약이 최신이 아닙니다. 다시요약을 권장합니다.</p>}
          <p className="weekly-summary-text">{summary.text}</p>
          <p className="weekly-summary-meta">{new Date(summary.generatedAt).toLocaleString("ko-KR")} 생성</p>
        </>
        : <p className="empty">{canGenerate ? "아직 생성된 요약이 없습니다. \"요약하기\"를 눌러 생성해 보세요." : "아직 생성된 요약이 없습니다."}</p>}
    </section>

    <Dialog.Root open={printOpen} onOpenChange={setPrintOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="calendar-modal-backdrop" />
        <Dialog.Content className="calendar-modal weekly-summary-print-modal" aria-describedby={undefined}>
          <header><Dialog.Title asChild><h2>요약정보 인쇄보기</h2></Dialog.Title><Dialog.Close asChild><button type="button" aria-label="창 닫기"><X aria-hidden="true" /></button></Dialog.Close></header>
          {summary && <table className="weekly-summary-print-table"><tbody>
            {parseSummarySections(summary.text).map((section) => <tr key={section.title}><th>{section.title}</th><td>{section.content}</td></tr>)}
          </tbody></table>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
