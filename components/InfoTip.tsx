import { Info } from "lucide-react";
import type { ReactNode } from "react";

/** 설명 툴팁 — 마우스를 올리거나 키보드로 포커스하면 말풍선이 열린다. 서버 컴포넌트에서 그대로 쓸 수 있다. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return <span className="info-tip">
    <button type="button" className="info-tip-button" aria-label={label}><Info size={14} aria-hidden="true" /></button>
    <span className="info-tip-bubble" role="tooltip">{children}</span>
  </span>;
}
