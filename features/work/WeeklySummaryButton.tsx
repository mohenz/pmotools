"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export function WeeklySummaryButton({ weekId }: { weekId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");

  async function generate() {
    setOpen(true);
    setPending(true); setError(""); setSummary("");
    try {
      const response = await fetch(`/api/v1/weekly-reports/${weekId}/summary`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? "요약을 생성하지 못했습니다.");
      setSummary(payload.data.text);
    } catch (e) { setError(e instanceof Error ? e.message : "요약을 생성하지 못했습니다."); }
    finally { setPending(false); }
  }

  return <>
    <button className="button secondary" type="button" onClick={generate}>AI 요약하기</button>
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next && !pending) setOpen(false); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="calendar-modal-backdrop" />
        <Dialog.Content className="calendar-modal weekly-summary-modal" aria-describedby={undefined}>
          <header><Dialog.Title asChild><h2>AI 요약</h2></Dialog.Title><Dialog.Close asChild><button type="button" aria-label="창 닫기" disabled={pending}><X aria-hidden="true" /></button></Dialog.Close></header>
          {pending && <p className="empty">요약을 생성하고 있습니다…</p>}
          {error && <p className="form-error">{error}</p>}
          {!pending && summary && <p className="weekly-summary-text">{summary}</p>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
