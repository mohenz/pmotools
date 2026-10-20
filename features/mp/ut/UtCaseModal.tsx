"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { utApi } from "@/features/mp/ut/client";
import { UtCaseScreen, type UtCaseNavParams } from "@/screens/mp/ut/UtCaseScreen";

type Payload = Parameters<typeof UtCaseScreen>[0];

// 테스트 케이스 정보확인/처리 모달 — 목록 주소의 ?case={id} 또는 ?new=1(&scenario=·&wbs=)로 연다(2026-10-20 사용자 요청).
export function UtCaseModal() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const caseId = search.get("case") ?? undefined;
  const isNew = search.get("new") === "1";
  const scenario = search.get("scenario") ?? undefined;
  const wbs = search.get("wbs") ?? undefined;
  const open = Boolean(caseId || isNew);
  const [data, setData] = useState<Omit<Payload, "modal"> | null>(null);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    if (!open) return;
    setError("");
    const params = new URLSearchParams();
    if (caseId) params.set("caseId", caseId);
    if (!caseId && scenario) params.set("scenario", scenario);
    if (!caseId && wbs) params.set("wbs", wbs);
    try { setData(await utApi(`editor?${params}`)); } catch (e) { setError((e as Error).message); }
  }, [open, caseId, scenario, wbs]);

  useEffect(() => { setData(null); void load(); }, [load]);

  const replaceParams = (next: UtCaseNavParams | null) => {
    const params = new URLSearchParams(search.toString());
    ["case", "new", "scenario"].forEach((k) => params.delete(k));
    if (next?.caseId) params.set("case", next.caseId);
    else if (next) { params.set("new", "1"); if (next.scenario) params.set("scenario", next.scenario); if (next.wbs) params.set("wbs", next.wbs); }
    router.replace(`${pathname}${params.toString() ? `?${params}` : ""}`, { scroll: false });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") replaceParams(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // 열려 있는 동안 뒤쪽 페이지 스크롤을 막는다.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || !mounted) return null;
  // 본문(main)은 CSS 컨테이너라 fixed 배치의 기준이 되므로, 화면 기준으로 띄우기 위해 body에 포털로 렌더링한다.
  return createPortal(<div className="modal-backdrop ut-case-backdrop" role="dialog" aria-modal="true" aria-label="테스트 케이스 정보" onClick={(e) => { if (e.target === e.currentTarget) replaceParams(null); }}>
    <div className="modal-card ut-case-modal">
      {error ? <><p className="action-message">{error}</p><div className="modal-actions"><button className="button secondary" onClick={() => replaceParams(null)}>닫기</button></div></>
        : !data ? <p className="ut-hint">불러오는 중…</p>
        : <UtCaseScreen key={`${caseId ?? ""}|${scenario ?? ""}|${wbs ?? ""}`} {...data} modal={{ close: () => replaceParams(null), reload: () => void load(), open: (p) => replaceParams(p) }} />}
    </div>
  </div>, document.body);
}
