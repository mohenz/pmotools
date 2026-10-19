"use client";
// [WBS2 복사본] 원본: components/WbsDelayedToggle.tsx — 2026-10-19 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.

import { useState } from "react";

export function WbsDelayedToggle({ defaultChecked }: { defaultChecked: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <label className="wbs-exclude-completed-toggle" title="지연(계획 대비 지연) 항목만 조회">
      <input type="hidden" name="delayed" value={checked ? "y" : ""} />
      <input
        type="checkbox"
        checked={checked}
        aria-label="지연여부"
        onChange={(e) => {
          const next = e.target.checked;
          setChecked(next);
          const form = e.target.form;
          if (form) {
            const hidden = form.querySelector('input[name="delayed"]') as HTMLInputElement | null;
            if (hidden) hidden.value = next ? "y" : "";
            form.requestSubmit();
          }
        }}
      />
      <span>지연</span>
    </label>
  );
}
