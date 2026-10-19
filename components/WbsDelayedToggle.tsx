"use client";

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
