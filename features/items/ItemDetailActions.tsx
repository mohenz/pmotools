"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { impacts, probabilities, statusLabels } from "@/lib/domain/items";
import type { CommonCode } from "@/lib/server/common-codes";
import type { ItemRow } from "@/lib/server/items";

type Options = { categories: CommonCode[]; tracks: CommonCode[]; escalations: CommonCode[] };

export function ItemDetailActions({ item, options }: { item: ItemRow; options: Options }) {
  const router = useRouter();
  const [version, setVersion] = useState(item.version);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState("");

  async function mutate(path: string, method: "POST" | "PATCH", body: Record<string, unknown>, action: string) {
    setPending(action); setMessage("");
    const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, version }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(payload?.error?.message ?? "요청을 처리하지 못했습니다."); setPending(""); return false;
    }
    if (payload?.data?.version) setVersion(payload.data.version);
    setPending(""); router.refresh(); return true;
  }

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(`/api/v1/items/${item.id}`, "PATCH", {
      categoryCodeId: form.get("categoryCodeId"), trackCodeId: form.get("trackCodeId"), title: form.get("title"),
      description: form.get("description"), probability: form.get("probability"), impact: form.get("impact"),
      exposureText: form.get("exposureText"), ownerText: form.get("ownerText"),
    }, "details");
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (await mutate(`/api/v1/items/${item.id}/comments`, "POST", { body: data.get("body") }, "comment")) form.reset();
  }

  async function archive() {
    if (!window.confirm("이 항목을 목록에서 보관 처리하시겠습니까?")) return;
    if (await mutate(`/api/v1/items/${item.id}/archive`, "POST", {}, "archive")) router.push("/items");
  }

  return <>
    <section className="panel action-panel">
      <div className="panel-head"><h2>상태 및 에스컬레이션</h2><span>변경 즉시 이력 기록</span></div>
      <div className="action-grid"><fieldset><legend>상태</legend><div className="chips">{Object.entries(statusLabels).map(([value, label]) => <button type="button" disabled={!!pending} className={item.status === value ? "selected" : ""} onClick={() => mutate(`/api/v1/items/${item.id}/status`, "PATCH", { status: value }, `status-${value}`)} key={value}>{pending === `status-${value}` ? "처리 중…" : label}</button>)}</div></fieldset>
      <fieldset><legend>에스컬레이션 레벨</legend><div className="chips">{options.escalations.map((code) => <button type="button" disabled={!!pending} className={item.escalationCodeId === code.id ? "selected" : ""} onClick={() => mutate(`/api/v1/items/${item.id}/escalation`, "PATCH", { escalationCodeId: code.id }, `level-${code.id}`)} key={code.id}>{pending === `level-${code.id}` ? "처리 중…" : code.label}</button>)}</div></fieldset></div>
    </section>

    <section className="panel form-panel detail-edit"><div className="panel-head"><h2>기본 정보 수정</h2><span>버전 {version}</span></div><form onSubmit={saveDetails}>
      <div className="form-grid"><label>유형<select name="categoryCodeId" defaultValue={item.categoryCodeId}>{options.categories.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label><label>관련 Track<select name="trackCodeId" defaultValue={item.trackCodeId}>{options.tracks.map((track) => <option value={track.id} key={track.id}>{track.label}</option>)}</select></label></div>
      <label>제목<input name="title" required maxLength={200} defaultValue={item.title} /></label>
      <label>상세 내용<textarea name="description" rows={4} maxLength={10000} defaultValue={item.description} /></label>
      <div className="form-grid"><label>발생 확률<select name="probability" defaultValue={item.probability} disabled={item.kind === "issue"}>{probabilities.map((value) => <option key={value.value} value={value.value}>{value.label}</option>)}</select>{item.kind === "issue" && <input type="hidden" name="probability" value="high" />}</label><label>영향도<select name="impact" defaultValue={item.impact}>{impacts.map((value) => <option key={value.value} value={value.value}>{value.label}</option>)}</select></label></div>
      <div className="form-grid"><label>예상 손실액/영향<input name="exposureText" maxLength={500} defaultValue={item.exposureText ?? ""} /></label><label>담당자<input name="ownerText" maxLength={100} defaultValue={item.ownerText ?? ""} /></label></div>
      <button className="button primary" type="submit" disabled={!!pending}>{pending === "details" ? "저장 중…" : "수정 저장"}</button>
    </form></section>

    <section className="panel comment-panel"><div className="panel-head"><h2>코멘트 추가</h2><span>조치 내용·논의 결과</span></div><form onSubmit={addComment}><textarea name="body" required maxLength={5000} rows={3} placeholder="조치 내용이나 논의 결과를 기록하세요." /><button className="button secondary" type="submit" disabled={!!pending}>{pending === "comment" ? "기록 중…" : "기록 추가"}</button></form></section>
    {message && <p className="form-error action-message" role="alert">{message}</p>}
    <section className="danger-zone"><div><strong>항목 보관</strong><p>보관된 항목은 일반 목록과 대시보드에서 제외됩니다.</p></div><button className="button danger" type="button" disabled={!!pending} onClick={archive}>{pending === "archive" ? "처리 중…" : "보관 처리"}</button></section>
  </>;
}
