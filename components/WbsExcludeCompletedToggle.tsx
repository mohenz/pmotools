"use client";

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
