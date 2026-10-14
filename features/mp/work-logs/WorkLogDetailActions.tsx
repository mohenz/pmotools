"use client";
// [WBS2 복사본] 원본: features/work/WorkLogDetailActions.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { WarningDialog } from "@/components/WarningDialog";

export function WorkLogDetailActions({ id, version, backHref, editable, deletable }: { id: string; version: number; backHref: string; editable: boolean; deletable: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!window.confirm("WBS상세내용을 삭제하시겠습니까?\n삭제된 WBS상세내용은 목록에서 제외됩니다.")) return;
    setPending(true); setError("");
    const response = await fetch(`/api/v1/mp/work-logs/${id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ version }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) { setError(payload?.error?.message ?? "WBS상세내용을 삭제하지 못했습니다."); setPending(false); return; }
    router.push(backHref); router.refresh();
  }

  return <><div className="work-log-detail-actions"><Link className="button secondary" href={backHref}>목록으로</Link>{editable && <Link className="button primary" href={`/mp-work-logs/${id}/edit`}>수정</Link>}{deletable && <button className="button danger" type="button" disabled={pending} onClick={remove}>{pending ? "삭제 중…" : "삭제하기"}</button>}</div><WarningDialog message={error} onClose={() => setError("")} /></>;
}
