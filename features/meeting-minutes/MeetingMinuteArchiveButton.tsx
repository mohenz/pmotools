"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WarningDialog } from "@/components/WarningDialog";

export function MeetingMinuteArchiveButton({ minuteId, version }: { minuteId: string; version: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  async function archive() {
    if (!window.confirm("이 회의록을 삭제할까요? 목록에서 사라지며 감사로그는 남습니다.")) return;
    setPending(true);
    const response = await fetch(`/api/v1/meeting-minutes/${minuteId}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ version }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) { setError(payload?.error?.message ?? "삭제하지 못했습니다."); setPending(false); return; }
    router.push("/meeting-minutes"); router.refresh();
  }
  return <>
    <button className="button ghost" type="button" onClick={archive} disabled={pending}>{pending ? "삭제 중…" : "삭제"}</button>
    <WarningDialog message={error} onClose={() => setError("")} />
  </>;
}
