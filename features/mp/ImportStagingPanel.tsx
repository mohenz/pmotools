"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { StagedCell } from "@/lib/domain/mp/import-staging";
import type { ImportKind, StagingRowView, StagingView } from "@/lib/server/mp/import-staging";
import { ImportErrorSummary, ImportFailurePanel, uploadErrorOf, type UploadError } from "@/features/mp/ImportErrorDetails";

// 엑셀 업로드 임시 저장(2026-09-30 결정) — 업로드하면 바로 반영하지 않고 임시 저장해 행별 정상/오류를 보여 준다.
//  - 오류 행만 화면에서 수정(저장마다 전체 재검증), 엑셀을 고쳐야 하면 [엑셀 수정 후 재업로드]로 교체
//  - [반영]은 오류가 없을 때만, 성공하면 임시 배치 삭제. 올린 사람만 보고 이어서 작업한다.

type Props = {
  kind: ImportKind;
  description: string;
  onApplied: (result: unknown) => void; // 반영 결과 표시는 화면별로
  applyConfirm?: (view: StagingView) => string; // 반영 확인 문구(요구사항 삭제 경고 등)
};

const DATE_VALUE = /^\d{4}-\d{2}-\d{2}$/;
// 형식만 맞고 없는 날짜(2026-13-45)를 날짜 입력칸에 넣으면 빈칸으로 보여 잘못된 값을 알 수 없으므로, 실제 날짜일 때만 날짜 입력칸을 쓴다.
const isRealDate = (value: string) => DATE_VALUE.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const norm = (s: string) => s.replace(/\s+/g, "");

export function ImportStagingPanel({ kind, description, onApplied, applyConfirm }: Props) {
  const [view, setView] = useState<StagingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");
  const [error, setError] = useState<UploadError | null>(null);
  const [errorsOnly, setErrorsOnly] = useState(true);
  const [editing, setEditing] = useState<StagingRowView | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/v1/mp/import-batches?kind=${kind}`);
    const payload = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) { setError(uploadErrorOf(response, payload, "업로드 내역을 불러오지 못했습니다.")); return; }
    setView(payload.data);
  }, [kind]);
  useEffect(() => { void load(); }, [load]);

  async function upload(file: File) {
    setPending("upload"); setError(null);
    const form = new FormData(); form.append("kind", kind); form.append("file", file);
    const response = await fetch("/api/v1/mp/import-batches", { method: "POST", body: form });
    const payload = await response.json().catch(() => null);
    setPending(""); if (fileRef.current) fileRef.current.value = "";
    if (!response.ok) { setError(uploadErrorOf(response, payload, "업로드하지 못했습니다.")); return; }
    setView(payload.data); setErrorsOnly(payload.data.summary.error > 0);
  }
  async function apply() {
    if (!view) return;
    setPending("apply"); setError(null);
    const response = await fetch(`/api/v1/mp/import-batches/${view.id}/apply`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: view.version }) });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setError(uploadErrorOf(response, payload, "반영하지 못했습니다.")); if (payload?.data) { setView(payload.data); setErrorsOnly(true); } return; }
    setView(null); onApplied(payload.data.result);
  }
  async function cancel() {
    if (!view) return;
    setPending("cancel"); setError(null);
    const response = await fetch(`/api/v1/mp/import-batches/${view.id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setError(uploadErrorOf(response, payload, "취소하지 못했습니다.")); return; }
    setView(null);
  }
  async function saveRow(row: StagingRowView, changed: Record<number, string>) {
    if (!view) return false;
    setPending("save"); setError(null);
    const response = await fetch(`/api/v1/mp/import-batches/${view.id}/rows/${row.rowNo}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: view.version, cells: changed }) });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setError(uploadErrorOf(response, payload, "수정을 저장하지 못했습니다.")); return false; }
    setView(payload.data);
    return true;
  }

  const picker = <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />;

  if (loading) return <p className="table-wrap-note">업로드 내역을 확인하는 중…</p>;
  if (!view) return <div className="import-staging">
    <p className="table-wrap-note">{description} 올린 파일은 먼저 <strong>임시 저장</strong>되어 행별 정상·오류를 확인한 뒤 반영합니다.</p>
    {picker}
    <button className="button primary" type="button" onClick={() => fileRef.current?.click()} disabled={!!pending}>{pending === "upload" ? "업로드·검증 중…" : "엑셀 업로드"}</button>
    {error && <ImportFailurePanel error={error} onClose={() => setError(null)} />}
  </div>;

  const { summary } = view;
  const visible = view.rows.filter((row) => (errorsOnly ? row.status === "ERROR" : true)).sort((a, b) => (a.status === b.status ? a.rowNo - b.rowNo : a.status === "ERROR" ? -1 : 1));
  const confirmText = applyConfirm?.(view) ?? `정상 ${summary.ok}행을 반영합니다.`;
  return <div className="import-staging">
    {picker}
    <div className="import-staging-head">
      <div>
        <strong>{view.fileName}</strong>
        <span className="table-wrap-note"> · 임시 저장 {new Date(view.updatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</span>
        <div className="import-staging-counts">
          <span className="badge">전체 {summary.total}행</span>
          <span className="badge band-green">정상 {summary.ok}</span>
          <span className={`badge ${summary.error ? "band-red" : ""}`}>오류 {summary.error}</span>
          {summary.actionCounts && <span className="table-wrap-note">유지 {summary.actionCounts.blank} · 삭제 {summary.actionCounts.delete} · 수정 {summary.actionCounts.update} · 신규 {summary.actionCounts.insert}</span>}
        </div>
      </div>
      <div className="import-staging-actions">
        <AlertDialog.Root>
          <AlertDialog.Trigger asChild><button className="button primary" type="button" disabled={!view.canApply || !!pending} title={view.canApply ? "" : "오류를 모두 고쳐야 반영할 수 있습니다"}>{pending === "apply" ? "반영 중…" : "반영"}</button></AlertDialog.Trigger>
          <AlertDialog.Portal><AlertDialog.Overlay className="calendar-modal-backdrop" /><AlertDialog.Content className="alert-dialog">
            <AlertDialog.Title asChild><h2>임시 저장한 내용을 반영하시겠습니까?</h2></AlertDialog.Title>
            <AlertDialog.Description asChild><p>{confirmText} 반영하면 임시 저장 내역은 삭제됩니다.</p></AlertDialog.Description>
            <div className="alert-dialog-actions"><AlertDialog.Cancel asChild><button className="button secondary" type="button">취소</button></AlertDialog.Cancel><AlertDialog.Action asChild><button className="button primary" type="button" onClick={apply}>반영</button></AlertDialog.Action></div>
          </AlertDialog.Content></AlertDialog.Portal>
        </AlertDialog.Root>
        <button className="button secondary" type="button" onClick={() => fileRef.current?.click()} disabled={!!pending}>{pending === "upload" ? "업로드·검증 중…" : "엑셀 수정 후 재업로드"}</button>
        <a className="button secondary" href={`/api/v1/mp/import-batches/${view.id}/download`}>현재 내용 엑셀로 받기</a>
        <AlertDialog.Root>
          <AlertDialog.Trigger asChild><button className="button ghost" type="button" disabled={!!pending}>임시 저장 취소</button></AlertDialog.Trigger>
          <AlertDialog.Portal><AlertDialog.Overlay className="calendar-modal-backdrop" /><AlertDialog.Content className="alert-dialog">
            <AlertDialog.Title asChild><h2>임시 저장을 취소하시겠습니까?</h2></AlertDialog.Title>
            <AlertDialog.Description asChild><p>업로드한 내용과 화면에서 고친 내용이 삭제됩니다. 실제 데이터는 바뀌지 않습니다.</p></AlertDialog.Description>
            <div className="alert-dialog-actions"><AlertDialog.Cancel asChild><button className="button secondary" type="button">닫기</button></AlertDialog.Cancel><AlertDialog.Action asChild><button className="button danger" type="button" onClick={cancel}>임시 저장 취소</button></AlertDialog.Action></div>
          </AlertDialog.Content></AlertDialog.Portal>
        </AlertDialog.Root>
      </div>
    </div>

    {error && <ImportFailurePanel error={error} onClose={() => setError(null)} />}
    {summary.fileErrors.length > 0 && <div className="import-failure" role="alert">
      <div className="import-failure-head"><strong>파일 단위 오류 — 화면에서 고칠 수 없습니다</strong></div>
      <ul className="import-cell-list">{summary.fileErrors.map((message) => <li key={message}>{message}</li>)}</ul>
      <p className="table-wrap-note">엑셀을 수정한 뒤 [엑셀 수정 후 재업로드]를 눌러 주세요.</p>
    </div>}
    {summary.willDeleteCount ? <p className="form-error" role="alert">반영하면 이 파일에 없는 기존 요구사항 {summary.willDeleteCount}건이 삭제됩니다.</p> : null}
    <ImportErrorSummary rows={view.rows.map((row) => ({ row: row.rowNo, errors: row.errors }))} />
    {summary.error > 0 && <p className="table-wrap-note">오류 행의 [수정]으로 바로 고칠 수 있습니다. 행을 추가·삭제해야 하거나 상위 Task가 파일에 없으면 엑셀을 고쳐 다시 올려 주세요.</p>}

    <div className="table-wrap">
      <p className="table-wrap-note">
        {summary.error > 0 && <label className="import-errors-only"><input type="checkbox" checked={errorsOnly} onChange={(event) => setErrorsOnly(event.target.checked)} /> 오류 행만 보기 ({summary.error}행)</label>}
      </p>
      <table className="import-staging-table">
        <thead><tr><th>행</th>{view.keyHeaders.map((header) => <th key={header}>{header}</th>)}<th>결과</th><th>오류·경고</th><th /></tr></thead>
        <tbody>
          {visible.slice(0, 500).map((row) => <tr key={row.rowNo} className={row.status === "ERROR" ? "high-risk-row" : undefined}>
            <td data-numeric>{row.rowNo}</td>
            {row.key.map((value, index) => <td key={index} className={index === 0 ? "mono" : undefined}>{value || "-"}</td>)}
            <td><span className={`badge ${row.status === "ERROR" ? "band-red" : "band-green"}`}>{row.status === "ERROR" ? "오류" : "정상"}</span>{row.edited && <span className="badge pmo-dash-tag">수정됨</span>}</td>
            <td>{row.errors.length || row.warnings.length ? <ul className="import-cell-list">{row.errors.map((message) => <li key={message} className="critical">{message}</li>)}{row.warnings.map((message) => <li key={message}>{message}</li>)}</ul> : "-"}</td>
            <td>{row.status === "ERROR" && <button className="button secondary small" type="button" onClick={() => setEditing(row)} disabled={!!pending}>수정</button>}</td>
          </tr>)}
          {!visible.length && <tr><td colSpan={view.keyHeaders.length + 4} className="empty">{view.rows.length ? "오류 행이 없습니다." : "읽을 수 있는 행이 없습니다."}</td></tr>}
        </tbody>
      </table>
      {visible.length > 500 && <p className="table-wrap-note">처음 500행만 표시합니다(전체 {visible.length}행). 오류 행은 항상 위에 표시됩니다.</p>}
    </div>

    {editing && <RowEditor key={`${editing.rowNo}-${view.version}`} view={view} row={view.rows.find((row) => row.rowNo === editing.rowNo) ?? editing} saving={pending === "save"}
      onClose={() => setEditing(null)} onSave={async (changed) => { if (await saveRow(editing, changed)) setEditing(null); }} />}
  </div>;
}

function RowEditor({ view, row, saving, onClose, onSave }: { view: StagingView; row: StagingRowView; saving: boolean; onClose: () => void; onSave: (changed: Record<number, string>) => void }) {
  const cells = row.cells ?? [];
  const initial = useMemo(() => view.headers.map((_, index) => cellToText(cells[index])), [view.headers, cells]);
  const [values, setValues] = useState<string[]>(initial);
  const errorText = row.errors.join(" ");
  // 오류 문구에 이름이 나오는 칸을 먼저 보여 준다(예: "StartDate에 유효한 날짜…" → StartDate)
  const fields = view.headers.map((header, index) => ({ header, index, related: Boolean(header) && errorText.includes(header) }))
    .filter((field) => field.header)
    .sort((a, b) => Number(b.related) - Number(a.related) || a.index - b.index);
  const changed = Object.fromEntries(values.flatMap((value, index) => (value !== initial[index] ? [[index, value]] : [])));
  const isDate = (header: string) => view.dateHeaders.some((h) => norm(h) === norm(header));
  const optionsOf = (header: string) => Object.entries(view.options).find(([key]) => norm(key) === norm(header))?.[1];
  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="calendar-modal-backdrop" />
      <Dialog.Content className="alert-dialog import-row-editor">
        <Dialog.Title asChild><h2>엑셀 {row.rowNo}행 수정</h2></Dialog.Title>
        <Dialog.Description asChild><div><ul className="import-cell-list">{row.errors.map((message) => <li key={message} className="critical">{message}</li>)}</ul></div></Dialog.Description>
        <div className="import-row-fields">
          {fields.map(({ header, index, related }) => {
            const options = optionsOf(header);
            const listId = options ? `import-options-${index}` : undefined;
            // 처음 값 기준으로 정한다 — 입력 중에 칸 종류가 바뀌지 않게. 잘못된 날짜는 글자 칸으로 원래 값을 보여 준다.
            const dateInput = isDate(header) && (initial[index] === "" || isRealDate(initial[index]));
            return <label key={index} className={related ? "related" : undefined}>
              <span>{header}{related && <small> 오류 관련</small>}</span>
              {values[index].length > 80
                ? <textarea value={values[index]} onChange={(event) => setValues((prev) => prev.map((v, i) => (i === index ? event.target.value : v)))} />
                : <input type={dateInput ? "date" : "text"} value={values[index]} list={listId} onChange={(event) => setValues((prev) => prev.map((v, i) => (i === index ? event.target.value : v)))} />}
              {options && <datalist id={listId}>{options.map((option) => <option key={option} value={option} />)}</datalist>}
            </label>;
          })}
        </div>
        <div className="alert-dialog-actions">
          <Dialog.Close asChild><button className="button secondary" type="button">닫기</button></Dialog.Close>
          <button className="button primary" type="button" disabled={saving || !Object.keys(changed).length} onClick={() => onSave(changed)}>{saving ? "저장·재검증 중…" : "저장 후 재검증"}</button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

const cellToText = (cell: StagedCell | undefined) => (cell === null || cell === undefined ? "" : String(cell));
