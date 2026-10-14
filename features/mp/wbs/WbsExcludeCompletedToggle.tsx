"use client";
// [WBS2 복사본] 원본: components/WbsExcludeCompletedToggle.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.

import { useState } from "react";

export function WbsExcludeCompletedToggle({ defaultChecked }: { defaultChecked: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <label className="wbs-exclude-completed-toggle" title="완료(실적 100%) 항목 제외">
      <input type="hidden" name="excludeCompleted" value={checked ? "y" : "n"} />
      <input
        type="checkbox"
        checked={checked}
        aria-label="완료제외"
        onChange={(e) => {
          const next = e.target.checked;
          setChecked(next);
          const form = e.target.form;
          if (form) {
            const hidden = form.querySelector('input[name="excludeCompleted"]') as HTMLInputElement | null;
            if (hidden) hidden.value = next ? "y" : "n";
            form.requestSubmit();
          }
        }}
      />
      <span>완료제외</span>
    </label>
  );
}
