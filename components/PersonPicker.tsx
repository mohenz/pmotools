"use client";

import { useState } from "react";

type Person = { id: string; userId: string; name: string };

export function PersonPicker({ people, selectedIds, selectedNames, onChange }: { people: Person[]; selectedIds: string[]; selectedNames: string[]; onChange: (selectedIds: string[], selectedNames: string[]) => void }) {
  const [query, setQuery] = useState(""), [guestInput, setGuestInput] = useState("");
  const q = query.trim().toLowerCase();
  const results = q ? people.filter((p) => !selectedIds.includes(p.id) && (p.name.toLowerCase().includes(q) || p.userId.toLowerCase().includes(q))).slice(0, 8) : [];
  const selectedPeople = people.filter((p) => selectedIds.includes(p.id));
  function addPerson(id: string) { onChange([...selectedIds, id], selectedNames); setQuery(""); }
  function removePerson(id: string) { onChange(selectedIds.filter((x) => x !== id), selectedNames); }
  function addGuest() { const name = guestInput.trim(); if (!name) return; onChange(selectedIds, [...selectedNames, name]); setGuestInput(""); }
  function removeGuestAt(index: number) { onChange(selectedIds, selectedNames.filter((_, i) => i !== index)); }
  return <>
    <div className="attendee-search">
      <input type="text" placeholder="이름 또는 아이디로 검색" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="구성원 검색" />
      {results.length > 0 && <ul className="attendee-suggestions">{results.map((p) => <li key={p.id}><button type="button" onClick={() => addPerson(p.id)}>{p.name} <small>({p.userId})</small></button></li>)}</ul>}
    </div>
    <div className="attendee-guest-add">
      <input type="text" placeholder="외부 인원 이름 직접 입력" value={guestInput} maxLength={50} onChange={(e) => setGuestInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGuest(); } }} aria-label="외부 인원 이름" />
      <button type="button" className="button secondary" onClick={addGuest}>추가</button>
    </div>
    {(selectedPeople.length > 0 || selectedNames.length > 0) ? <ul className="attendee-chips">
      {selectedPeople.map((p) => <li key={p.id}>{p.name} <small>({p.userId})</small><button type="button" aria-label={`${p.name} 제거`} onClick={() => removePerson(p.id)}>×</button></li>)}
      {selectedNames.map((name, i) => <li key={`guest-${i}`}>{name} <small>(외부)</small><button type="button" aria-label={`${name} 제거`} onClick={() => removeGuestAt(i)}>×</button></li>)}
    </ul> : <p className="attendee-empty">선택된 인원이 없습니다.</p>}
  </>;
}
