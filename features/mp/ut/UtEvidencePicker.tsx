"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UT_EVIDENCE_MAX_FILES } from "@/lib/domain/ut";

// 증적 파일 선택 — 파일 선택 또는 클립보드(캡처 이미지 붙여넣기)로 최대 3개까지 담는다(2026-10-23 사용자 요청).
// 파일은 상위 폼이 전송할 때 FormData에 넣는다(입력 요소는 폼 밖에서 상태로 관리).
const ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.log,.json,.xml,.html,.csv,.xls,.xlsx,.doc,.docx,.ppt,.pptx,.zip";

const stamp = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
const sizeLabel = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

export function UtEvidencePicker({ files, onChange, disabled }: { files: File[]; onChange: (files: File[]) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [mounted, setMounted] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => setMounted(true), []);

  const add = (incoming: File[]) => {
    if (!incoming.length) return;
    const room = UT_EVIDENCE_MAX_FILES - filesRef.current.length;
    if (room <= 0) { setNotice(`증적은 최대 ${UT_EVIDENCE_MAX_FILES}개까지 등록할 수 있습니다.`); return; }
    const next = incoming.slice(0, room);
    setNotice(incoming.length > room ? `증적은 최대 ${UT_EVIDENCE_MAX_FILES}개까지 등록할 수 있어 ${next.length}개만 추가했습니다.` : "");
    filesRef.current = [...filesRef.current, ...next];
    onChange(filesRef.current);
  };

  // 클립보드 이미지 — 팝업이 열려 있거나 증적 영역 위에서 붙여넣기(Ctrl+V)해도 담긴다.
  const fromClipboard = (event: ClipboardEvent | React.ClipboardEvent) => {
    const images = [...(event.clipboardData?.items ?? [])].filter((i) => i.kind === "file" && i.type.startsWith("image/")).map((i) => i.getAsFile()).filter((f): f is File => !!f);
    if (!images.length) return;
    event.preventDefault();
    const base = stamp();
    const offset = filesRef.current.length;
    add(images.map((f, i) => new File([f], `캡처_${base}_${offset + i + 1}.${f.type.split("/")[1]?.replace("jpeg", "jpg") || "png"}`, { type: f.type })));
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onPaste = (e: ClipboardEvent) => fromClipboard(e);
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("paste", onPaste); };
  });

  const remove = (index: number) => { setNotice(""); filesRef.current = files.filter((_, i) => i !== index); onChange(filesRef.current); };
  const full = files.length >= UT_EVIDENCE_MAX_FILES;

  const list = files.length
    ? <ul className="ut-evidence-list">{files.map((f, i) => <li key={`${f.name}-${i}`}><span className="ut-evidence-name" title={f.name}>{f.name}</span><small>{sizeLabel(f.size)}</small><button type="button" className="button secondary" onClick={() => remove(i)} disabled={disabled}>삭제</button></li>)}</ul>
    : <p className="ut-hint">선택한 증적이 없습니다.</p>;

  return <div className="ut-field ut-evidence" onPaste={(e) => { if (!open && !disabled) fromClipboard(e); }}>
    <span>증적 파일 ({files.length}/{UT_EVIDENCE_MAX_FILES})</span>
    <div className="ut-evidence-bar">
      <button type="button" className="button secondary" onClick={() => { setNotice(""); setOpen(true); }} disabled={disabled}>파일 선택</button>
      <small className="ut-hint">캡처 이미지는 수행 결과 입력란에서 Ctrl+V로 붙여넣을 수 있습니다.</small>
    </div>
    {!open && notice && <p className="ut-hint" role="status">{notice}</p>}
    {list}
    {open && mounted && createPortal(<div className="modal-backdrop ut-evidence-backdrop" role="dialog" aria-modal="true" aria-label="증적 파일 선택" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="modal-card ut-evidence-modal">
        <h2>증적 파일 선택</h2>
        <p className="ut-hint">파일을 선택하거나 캡처한 이미지를 Ctrl+V로 붙여넣으세요. 최대 {UT_EVIDENCE_MAX_FILES}개까지 등록할 수 있습니다.</p>
        <div className="ut-evidence-drop" tabIndex={0} onPaste={(e) => fromClipboard(e)}>
          <button type="button" className="button primary" onClick={() => input.current?.click()} disabled={full}>파일 선택</button>
          <span>또는 이 영역을 클릭한 뒤 Ctrl+V</span>
          <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ""; }} />
        </div>
        {notice && <p className="action-message" role="status">{notice}</p>}
        {list}
        <div className="modal-actions"><button type="button" className="button primary" onClick={() => setOpen(false)}>확인</button></div>
      </div>
    </div>, document.body)}
  </div>;
}
