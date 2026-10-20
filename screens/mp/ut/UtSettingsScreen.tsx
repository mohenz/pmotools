"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { getUtSettings } from "@/lib/server/mp/ut/milestones";
import { json, utApi } from "@/features/mp/ut/client";

type Settings = Awaited<ReturnType<typeof getUtSettings>>;

// UT-010 — UT 기간·샘플링 비율·마감 잠금(PMO). WBS 동기화 화면은 폐지(WBS 직접 참조).
export function UtSettingsScreen({ settings, canManage }: { settings: Settings; canManage: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  function call(path: string, method: string, body: unknown, done: string) {
    setPending(true); setMessage(null);
    utApi(path, json(method, body)).then(() => { setMessage({ tone: "ok", text: done }); router.refresh(); }).catch((e: Error) => setMessage({ tone: "error", text: e.message })).finally(() => setPending(false));
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    call("settings", "PUT", { utStartDate: f.get("utStartDate") || null, utEndDate: f.get("utEndDate") || null, samplingRate: Number(f.get("samplingRate")) }, "설정을 저장했습니다.");
  }
  function lock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = new FormData(event.currentTarget).get("reason");
    call("settings/lock", "POST", { locked: !settings.lockedAt, reason }, settings.lockedAt ? "잠금을 해제했습니다." : "마감 잠금했습니다.");
  }

  return <>
    <header className="topbar"><div><h1>단위테스트 설정</h1><p>UT 기간·PMO 샘플링 비율·마감 잠금{canManage ? "" : " (조회 전용 — PM/PMO만 변경)"}</p></div></header>
    <div className="content">
      {message && <p className={`action-message ${message.tone === "ok" ? "ut-ok" : ""}`} role="status">{message.text}</p>}
      <section className="panel form-panel"><form onSubmit={save}>
        <div className="form-grid triple">
          <label>UT 시작일<input type="date" name="utStartDate" defaultValue={settings.utStartDate ?? ""} disabled={!canManage} /></label>
          <label>UT 종료일<input type="date" name="utEndDate" defaultValue={settings.utEndDate ?? ""} disabled={!canManage} /></label>
          <label>PMO 샘플링 비율(%)<input type="number" min={0} max={100} name="samplingRate" defaultValue={settings.samplingRate} disabled={!canManage} /></label>
        </div>
        {canManage && <div className="form-actions"><button className="button primary" disabled={pending}>저장</button></div>}
      </form></section>
      <section className="panel form-panel">
        <div className="panel-head"><h2>마감 잠금</h2><span>{settings.lockedAt ? `잠금 중 · ${settings.lockedBy ?? ""} · ${new Date(settings.lockedAt).toLocaleString("ko-KR")}` : "잠금 안 됨"}</span></div>
        {settings.lockReason && <p className="ut-hint">사유: {settings.lockReason}</p>}
        {canManage && <form onSubmit={lock}>
          <label>{settings.lockedAt ? "해제 사유(PM 승인 내용 포함)" : "잠금 사유"}<input name="reason" required maxLength={1000} /></label>
          <div className="form-actions"><button className="button primary" disabled={pending}>{settings.lockedAt ? "잠금 해제" : "마감 잠금"}</button></div>
        </form>}
      </section>
    </div>
  </>;
}
