"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { impacts, probabilities, riskScore, type Impact, type ItemKind, type Probability } from "@/lib/domain/items";
import type { CommonCode } from "@/lib/server/common-codes";

type Options = { categories: CommonCode[]; tracks: CommonCode[]; escalations: CommonCode[] };

export function ItemCreateScreen({ options }: { options: Options }) {
  const router = useRouter();
  const [kind, setKind] = useState<ItemKind>("issue");
  const [probability, setProbability] = useState<Probability>("high");
  const [impact, setImpact] = useState<Impact>("high");
  const [manualEscalationId, setManualEscalationId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const suggested = useMemo(() => {
    const score = riskScore(kind, probability, impact);
    return options.escalations.filter((code) => (code.minScore ?? 1) <= score).sort((a, b) => (b.minScore ?? 1) - (a.minScore ?? 1))[0] ?? options.escalations[0];
  }, [kind, probability, impact, options.escalations]);
  const selectedEscalationId = manualEscalationId ?? suggested?.id;
  const ready = options.categories.length > 0 && options.tracks.length > 0 && options.escalations.length > 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/items", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind, probability, impact, escalationCodeId: selectedEscalationId,
        categoryCodeId: form.get("categoryCodeId"), trackCodeId: form.get("trackCodeId"), title: form.get("title"),
        description: form.get("description"), exposureText: form.get("exposureText"), ownerText: form.get("ownerText"),
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "등록하지 못했습니다."); setSaving(false); return;
    }
    router.push("/items"); router.refresh();
  }

  return <>
    <header className="topbar"><div><h1>이슈·리스크 등록</h1><p>신규 통제 항목 생성</p></div></header>
    <div className="content"><section className="panel form-panel"><form onSubmit={submit}>
      {!ready && <p className="form-error" role="alert">활성 공통코드가 부족합니다. 설정에서 유형·Track·에스컬레이션 레벨을 확인해 주세요.</p>}
      <fieldset><legend>구분</legend><div className="chips">
        <button type="button" className={kind === "issue" ? "selected" : ""} onClick={() => setKind("issue")}>이슈 (이미 발생)</button>
        <button type="button" className={kind === "risk" ? "selected" : ""} onClick={() => setKind("risk")}>리스크 (잠재 사안)</button>
      </div></fieldset>
      <div className="form-grid"><label>유형<select name="categoryCodeId" required>{options.categories.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
        <label>관련 Track<select name="trackCodeId" required>{options.tracks.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label></div>
      <label>제목<input name="title" required maxLength={200} placeholder="예: 결제 PG 연동 응답 지연" /></label>
      <label>상세 내용<textarea name="description" rows={4} maxLength={10000} placeholder="현황, 원인, 파급 범위를 구체적으로 기술" /></label>
      <div className="form-grid"><fieldset><legend>발생 확률 {kind === "issue" && <small>(이슈는 상 고정)</small>}</legend><div className="chips">
        {probabilities.map((item) => <button type="button" disabled={kind === "issue"} className={(kind === "issue" ? item.value === "high" : probability === item.value) ? "selected" : ""} onClick={() => setProbability(item.value)} key={item.value}>{item.label}</button>)}
      </div></fieldset><fieldset><legend>영향도</legend><div className="chips">
        {impacts.map((item) => <button type="button" className={impact === item.value ? "selected" : ""} onClick={() => setImpact(item.value)} key={item.value}>{item.label}</button>)}
      </div></fieldset></div>
      <div className="form-grid"><label>예상 손실액/영향<input name="exposureText" maxLength={500} placeholder="예: 약 5천만원 / 일정 2주 지연" /></label>
        <label>담당자<input name="ownerText" maxLength={100} placeholder="이름 / 소속" /></label></div>
      <fieldset><legend>에스컬레이션 레벨 <small>(자동 제안 후 수동 조정 가능)</small></legend><div className="chips">{options.escalations.map((code) => <button type="button" className={selectedEscalationId === code.id ? "selected" : ""} onClick={() => setManualEscalationId(code.id)} key={code.id}>{code.label}</button>)}</div></fieldset>
      <div className="suggest"><span className="badge">{suggested?.label ?? "설정 필요"}</span><p>현재 확률×영향 기준 자동 제안 레벨입니다.</p>{manualEscalationId && <button className="text-button" type="button" onClick={() => setManualEscalationId(null)}>자동 제안 적용</button>}</div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button primary" type="submit" disabled={saving || !ready}>{saving ? "등록 중…" : "등록하기"}</button>
    </form></section></div>
  </>;
}

