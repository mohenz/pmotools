"use client";

// 값 하나만 고르는 코드(심각도·우선순위)를 체크박스 줄로 보여 준다. 하나를 체크하면 이전 체크는 풀린다.
// 선택 해제가 가능한 항목(allowEmpty)은 체크된 값을 다시 눌러 비울 수 있다. 폼 전송용 hidden 입력(name)을 함께 낸다.
export function OptionChecks({ name, label, options, value, onChange, disabled, allowEmpty = false }: {
  name: string; label: string; options: { id: string; label: string }[]; value: string; onChange: (id: string) => void; disabled?: boolean; allowEmpty?: boolean;
}) {
  return <div className="ut-field defect-check-field">
    <span id={`${name}-label`}>{label}</span>
    <input type="hidden" name={name} value={value} />
    <div className="defect-checks" role="group" aria-labelledby={`${name}-label`}>
      {options.map((o) => <label key={o.id} className="toggle">
        <input type="checkbox" checked={value === o.id} disabled={disabled}
          onChange={(e) => { if (e.target.checked) onChange(o.id); else if (allowEmpty) onChange(""); }} /> {o.label}
      </label>)}
    </div>
  </div>;
}
