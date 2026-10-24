"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";

type Stage = { id: string; label: string; locked: boolean };

// 결함관리 테스트 단계 — 단계를 등록하고, 잠금으로 체크한 단계는 결함관리 화면에서 보이지 않는다. 순서와 잠금은 "저장"을 눌러야 반영된다.
export function ProjectTestStagesPanel({ projectId, stages }: { projectId: string; stages: Stage[] }) {
  const router = useRouter();
  const [locks, setLocks] = useState<Record<string, boolean>>(() => Object.fromEntries(stages.map((s) => [s.id, s.locked])));
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [order, setOrder] = useState<string[]>(() => stages.map((s) => s.id));
  const byId = new Map(stages.map((s) => [s.id, s]));
  const dirty = stages.some((s) => locks[s.id] !== s.locked) || order.some((id, i) => id !== stages[i]?.id);
  const move = (index: number, delta: number) => setOrder((prev) => { const next = [...prev]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return next; });

  async function call(method: "POST" | "PUT", body: unknown, done: string) {
    setPending(true); setMessage(null);
    const response = await fetch(`/api/v1/admin/projects/${projectId}/test-stages`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) { setMessage({ tone: "error", text: payload?.error?.message ?? "저장하지 못했습니다." }); return false; }
    setMessage({ tone: "ok", text: done }); router.refresh(); return true;
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const label = String(new FormData(form).get("label") ?? "");
    if (await call("POST", { label }, "테스트 단계를 등록했습니다.")) form.reset();
  }

  return <section className="panel" aria-label="테스트 단계">
    <div className="panel-head"><div><h2>테스트 단계</h2><p className="group-description">결함관리에서 쓰는 테스트 단계입니다. 위·아래 버튼으로 순서를 바꾸면 결함관리 화면의 선택지와 필터가 같은 순서로 나옵니다. 잠금으로 체크한 단계는 결함관리 화면에서 보이지 않으며, 이미 등록된 결함은 그대로 남습니다.</p></div></div>
    {message && <p className={`action-message ${message.tone === "ok" ? "ut-ok" : ""}`} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p>}
    <div className="table-wrap"><table className="dense-table">
      <thead><tr><th>순서</th><th>단계</th><th>잠금</th></tr></thead>
      <tbody>{order.map((id, i) => { const s = byId.get(id)!; return <tr key={id}>
        <td><span className="defect-inline"><span data-numeric>{i + 1}</span>
          <button type="button" className="button secondary defect-icon-button" disabled={pending || i === 0} aria-label={`${s.label} 위로`} title="위로" onClick={() => move(i, -1)}><ArrowUp aria-hidden="true" /></button>
          <button type="button" className="button secondary defect-icon-button" disabled={pending || i === order.length - 1} aria-label={`${s.label} 아래로`} title="아래로" onClick={() => move(i, 1)}><ArrowDown aria-hidden="true" /></button></span></td>
        <td>{s.label}</td>
        <td><label className="toggle"><input type="checkbox" checked={locks[s.id] ?? false} disabled={pending} onChange={(e) => setLocks({ ...locks, [s.id]: e.target.checked })} /> 잠금</label></td>
      </tr>; })}</tbody>
    </table></div>
    <div className="form-actions"><button className="button primary" type="button" disabled={!dirty || pending} onClick={() => void call("PUT", { locks, order }, "테스트 단계 설정을 저장했습니다.")}>{pending ? "저장 중…" : "저장"}</button></div>
    <form className="filters" onSubmit={(e) => void add(e)}>
      <label>새 테스트 단계<input name="label" required maxLength={50} autoComplete="off" placeholder="예: 인수" /></label>
      <button className="button secondary" type="submit" disabled={pending}>단계 등록</button>
    </form>
  </section>;
}
