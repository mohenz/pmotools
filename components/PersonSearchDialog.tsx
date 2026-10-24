"use client";

import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export type SearchablePerson = { id: string; userId: string; name: string; groups: string };

const NO_GROUP = "업무그룹 없음";
const MAX_RESULTS = 50;

// 담당자 검색 공통 팝업 — 이름·아이디(업무그룹도 가능)로 조회하고 결과에서 한 명을 선택한다.
// 크기는 고정이며 결과 영역만 스크롤된다. 동명이인은 업무그룹·아이디로 구분한다.
export function PersonSearchDialog({ title = "담당자 검색", people, trigger, onSelect }: {
  title?: string; people: SearchablePerson[]; trigger: ReactNode; onSelect: (person: SearchablePerson) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<string | null>(null);

  const q = (searched ?? "").trim().toLowerCase();
  const results = searched === null ? [] : people.filter((p) => !q || p.name.toLowerCase().includes(q) || p.userId.toLowerCase().includes(q) || p.groups.toLowerCase().includes(q));

  function handleOpen(next: boolean) { setOpen(next); if (next) { setQuery(""); setSearched(null); } }

  return <Dialog.Root open={open} onOpenChange={handleOpen}>
    <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="calendar-modal-backdrop" />
      <Dialog.Content className="calendar-modal person-search-dialog" aria-describedby={undefined}>
        <header>
          <div><Dialog.Title asChild><h2>{title}</h2></Dialog.Title></div>
          <Dialog.Close asChild><button type="button" aria-label={`${title} 창 닫기`}><X aria-hidden="true" /></button></Dialog.Close>
        </header>
        <div className="person-search-bar">
          <input type="search" value={query} autoFocus autoComplete="off" aria-label="이름 또는 아이디" placeholder="이름 또는 아이디(업무그룹도 가능)"
            onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setSearched(query); } }} />
          <button type="button" className="button primary" onClick={() => setSearched(query)}>조회</button>
        </div>
        <p className="ut-hint" role="status" aria-live="polite">
          {searched === null ? "이름이나 아이디를 입력하고 조회해 주세요. 비워 두고 조회하면 전체 구성원이 나옵니다."
            : results.length === 0 ? "조회된 구성원이 없습니다. 이름이나 아이디를 다시 확인해 주세요."
            : `${results.length}명 조회${results.length > MAX_RESULTS ? ` (앞의 ${MAX_RESULTS}명만 표시, 조건을 더 좁혀 주세요)` : ""}`}
        </p>
        <div className="table-wrap person-search-results">
          {results.length > 0 && <table className="ut-table">
            <thead><tr><th>이름</th><th>아이디</th><th>업무그룹</th><th><span className="sr-only">선택</span></th></tr></thead>
            <tbody>{results.slice(0, MAX_RESULTS).map((p) => <tr key={p.id}>
              <td>{p.name}</td><td className="mono">{p.userId}</td><td>{p.groups || NO_GROUP}</td>
              <td><button type="button" className="button secondary sm" aria-label={`${p.name}(${p.userId}) 선택`} onClick={() => { onSelect(p); setOpen(false); }}>선택</button></td>
            </tr>)}</tbody>
          </table>}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
