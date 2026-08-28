"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function WorkLogDetailActions({ id, version, backHref, editable, deletable }: { id: string; version: number; backHref: string; editable: boolean; deletable: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!window.confirm("업무일지를 삭제하시겠습니까?\n삭제된 업무일지는 목록에서 제외됩니다.")) return;
    setPending(true); setError("");
    const response = await fetch(`/api/v1/work-logs/${id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ version }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) { setError(payload?.error?.message ?? "업무일지를 삭제하지 못했습니다."); setPending(false); return; }
    router.push(backHref); router.refresh();
  }

  return <><div className="work-log-detail-actions"><Link className="button secondary" href={backHref}>목록으로</Link>{editable && <Link className="button primary" href={`/work-logs/${id}/edit`}>수정</Link>}{deletable && <button className="button danger" type="button" disabled={pending} onClick={remove}>{pending ? "삭제 중…" : "삭제하기"}</button>}</div>{error && <p className="form-error action-message" role="alert">{error}</p>}</>;
}
