"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { PersonSearchDialog, type SearchablePerson } from "@/components/PersonSearchDialog";

// 조회 조건용 담당자 선택 — 입력창에 선택된 사람을 보여 주고 공통 담당자 검색 팝업으로 고른다.
// GET 폼으로 함께 전송되도록 hidden 입력(name)을 내며, 선택하지 않으면 빈 값(전체)이다.
export function PersonFilterField({ people, name, initialId = "", label = "담당자", emptyLabel = "전체 담당자" }: {
  people: SearchablePerson[]; name: string; initialId?: string; label?: string; emptyLabel?: string;
}) {
  const [id, setId] = useState(initialId);
  const selected = people.find((p) => p.id === id) ?? null;
  return <div className="person-filter">
    <input type="hidden" name={name} value={id} />
    <input readOnly value={selected ? `${selected.name} (${selected.userId})` : ""} placeholder={emptyLabel} aria-label={label} />
    <PersonSearchDialog title={`${label} 검색`} people={people} onSelect={(p) => setId(p.id)}
      trigger={<button type="button" className="button secondary person-filter-button" aria-label={`${label} 검색`} title={`${label} 검색`}><Search aria-hidden="true" /></button>} />
    {selected && <button type="button" className="button secondary person-filter-button" aria-label={`${label} 선택 해제`} title="선택 해제" onClick={() => setId("")}><X aria-hidden="true" /></button>}
  </div>;
}
