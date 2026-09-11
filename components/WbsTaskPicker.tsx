"use client";

import { useState } from "react";

type WbsTaskOption = { code: string; name: string };

// wbsNumber는 여전히 자유 입력 텍스트 필드다 — 이 컴포넌트는 값을 코드+이름으로 보고 고를 수 있는 검색 제안을 얹을 뿐,
// 목록에 없는 값도 그대로 입력해 제출할 수 있다(필수 아님).
export function WbsTaskPicker({ options, defaultValue = "" }: { options: WbsTaskOption[]; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const results = (q ? options.filter((o) => o.code.toLowerCase().includes(q) || o.name.toLowerCase().includes(q)) : options).slice(0, 8);
  function select(code: string) { setValue(code); setOpen(false); }
  return <div className="attendee-search">
    <input
      type="text" name="wbsNumber" value={value} maxLength={100} autoComplete="off"
      placeholder="예: 1.2.3 (직접 입력 또는 아래 목록에서 선택, 선택 사항)"
      onChange={(e) => { setValue(e.target.value); setOpen(true); }}
      onFocus={() => setOpen(true)}
      onBlur={() => setTimeout(() => setOpen(false), 150)}
    />
    {open && results.length > 0 && <ul className="attendee-suggestions">
      {results.map((o) => <li key={o.code}><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => select(o.code)}><span className="mono">{o.code}</span> {o.name}</button></li>)}
    </ul>}
    {open && q && results.length === 0 && <p className="attendee-empty">일치하는 담당 WBS Task가 없습니다. 직접 입력한 값이 그대로 저장됩니다.</p>}
  </div>;
}
