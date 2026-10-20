"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { getPlReference, getUtFormOptions, listUtWbsLeaves } from "@/lib/server/mp/ut/scenarios";
import { json, utApi } from "@/features/mp/ut/client";

type Options = Awaited<ReturnType<typeof getUtFormOptions>>;
type Leaf = Awaited<ReturnType<typeof listUtWbsLeaves>>[number];
type PlRef = Awaited<ReturnType<typeof getPlReference>>;

// 시나리오 등록 — 업무단위·PL은 사람이 직접 선택(4.4). 화면은 작성자 소속 그룹·리더를 참고로 보여 준다.
export function UtScenarioCreateScreen({ options, leaves, plReference, userId }: { options: Options; leaves: Leaf[]; plReference: PlRef; userId: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [wbsItemId, setWbsItemId] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (k ? leaves.filter((l) => `${l.displayId} ${l.code} ${l.name} ${l.ownerName ?? ""}`.toLowerCase().includes(k)) : leaves).slice(0, 200);
  }, [q, leaves]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    const f = new FormData(event.currentTarget);
    const v = (name: string) => (f.get(name) as string) || null;
    try {
      const created = await utApi<{ id: string }>("scenarios", json("POST", { wbsItemId, groupId: v("groupId"), name: f.get("name"), priority: f.get("priority"), plUserId: v("plUserId"), programId: v("programId"), requirementId: v("requirementId") }));
      router.push(`/mp-ut/${created.id}`);
    } catch (e) { setError((e as Error).message); setPending(false); }
  }

  return <>
    <header className="topbar"><div><h1>시나리오 등록</h1><p>최하위(Leaf) WBS에 시나리오를 만들고 케이스를 추가합니다.</p></div></header>
    <div className="content"><section className="panel form-panel"><form onSubmit={submit}>
      <label className="field-label">WBS (Leaf)</label>
      <input type="search" placeholder="WBS ID·코드·명·담당자 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="WBS 검색" />
      <select required size={8} value={wbsItemId} onChange={(e) => setWbsItemId(e.target.value)} aria-label="WBS 선택" className="ut-wbs-select">
        {filtered.map((l) => <option key={l.id} value={l.id}>{l.displayId} · {l.code} {l.name}{l.ownerName ? ` (${l.ownerName})` : ""}</option>)}
      </select>
      <small className="ut-hint">{leaves.length}개 Leaf 중 {filtered.length}개 표시</small>
      <label>시나리오명<input name="name" required maxLength={200} placeholder="예: 주문 수량 입력 검증" /></label>
      <div className="form-grid">
        <label>업무단위<select name="groupId" required defaultValue={plReference[0]?.groupId ?? ""}><option value="" disabled>선택</option>{options.groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
        <label>우선순위<select name="priority" defaultValue="M"><option value="H">H — 결제·주문·권한·저장·정산</option><option value="M">M — 조회·변경</option><option value="L">L — 표시·문구</option></select></label>
      </div>
      <div className="form-grid">
        <label>PL 확인자<select name="plUserId" defaultValue=""><option value="">나중에 지정</option>{options.members.filter((m) => m.id !== userId).map((m) => <option key={m.id} value={m.id}>{m.name} ({m.userId})</option>)}</select></label>
        <div className="ut-reference"><span className="field-label">참고: 내 소속 업무그룹 리더</span>{plReference.length ? plReference.map((r) => <p key={r.groupId}>{r.groupLabel} — {r.leaderName ?? "리더 미지정"}</p>) : <p>소속 업무그룹이 없습니다.</p>}</div>
      </div>
      <div className="form-grid">
        <label>프로그램(선택)<select name="programId" defaultValue=""><option value="">미지정</option>{options.programs.map((p) => <option key={p.id} value={p.id}>{p.programCode} {p.name}</option>)}</select></label>
        <label>요구사항(선택)<select name="requirementId" defaultValue=""><option value="">미지정</option>{options.requirements.map((r) => <option key={r.id} value={r.id}>{r.displayId} {r.title}</option>)}</select></label>
      </div>
      <p className="form-error" role="alert">{error}</p>
      <div className="form-actions"><button className="button primary" disabled={pending || !wbsItemId}>{pending ? "등록 중…" : "등록"}</button></div>
    </form></section></div>
  </>;
}
