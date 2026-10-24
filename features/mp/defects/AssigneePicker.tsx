"use client";

import { Search, X } from "lucide-react";
import { PersonSearchDialog, type SearchablePerson } from "@/components/PersonSearchDialog";

export type AssigneeOption = SearchablePerson;

// 조치자 입력 — 입력창에는 선택된 사람이 표시되고, "검색" 버튼으로 공통 담당자 검색 팝업(PersonSearchDialog)을 연다.
// 선택값은 상위에서 관리하고, 폼 전송용 hidden 입력(name)도 함께 낸다.
export function AssigneePicker({ members, value, onChange, name, label = "조치자", disabled }: {
  members: AssigneeOption[]; value: string; onChange: (id: string) => void; name?: string; label?: string; disabled?: boolean;
}) {
  const selected = members.find((m) => m.id === value) ?? null;
  return <div className="defect-assignee">
    {name && <input type="hidden" name={name} value={value} />}
    <div className="defect-inline">
      <input readOnly value={selected?.name ?? ""} placeholder={`${label}를 검색해 선택하세요`} aria-label={label} />
      <PersonSearchDialog people={members} onSelect={(p) => onChange(p.id)}
        trigger={<button type="button" className="button secondary defect-icon-button" disabled={disabled} aria-label={`${label} 검색`} title={`${label} 검색`}><Search aria-hidden="true" /></button>} />
      {selected && <button type="button" className="button secondary defect-icon-button" disabled={disabled} aria-label={`${label} 선택 해제`} title="선택 해제" onClick={() => onChange("")}><X aria-hidden="true" /></button>}
    </div>
  </div>;
}
