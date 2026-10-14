"use client";
// [WBS2 복사본] 원본: features/requirements/RequirementChangeActions.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WarningDialog } from "@/components/WarningDialog";

export function RequirementChangeActions({ changeId }: { changeId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"approved" | "rejected" | "">("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  async function decide(decision: "approved" | "rejected") {
    setPending(decision); setMessage("");
    const response = await fetch(`/api/v1/mp/requirements/changes/${changeId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, decisionNote: note || undefined }),
    });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "처리하지 못했습니다."); return; }
    router.refresh();
  }

  return <div className="change-actions">
    <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="검토의견 (선택)" maxLength={2000} aria-label="검토의견" />
    <div className="topbar-actions">
      <button className="button primary" type="button" disabled={!!pending} onClick={() => decide("approved")}>{pending === "approved" ? "처리 중…" : "승인"}</button>
      <button className="button danger" type="button" disabled={!!pending} onClick={() => decide("rejected")}>{pending === "rejected" ? "처리 중…" : "반려"}</button>
    </div>
    <WarningDialog message={message} onClose={() => setMessage("")} />
  </div>;
}
