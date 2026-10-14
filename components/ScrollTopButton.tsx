"use client";

import { ArrowUpToLine } from "lucide-react";
import { useEffect, useState } from "react";

// 최상단으로 이동 플로팅 버튼(2026-10-01, SSG.COM 플로팅 "최상단으로 이동"과 같은 동작).
// 아이콘: react-icons Lucide 세트 LuArrowUpToLine과 같은 아이콘 — 서버 배포 훅이 npm install을 하지 않아
// 새 패키지 대신 이미 설치된 lucide-react의 ArrowUpToLine을 쓴다.
// 화면을 300px 이상 내렸을 때만 보이고, 누르면 맨 위로 이동한 뒤 키보드 초점을 본문 처음으로 옮긴다.
const SHOW_AFTER = 300;

export function ScrollTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > SHOW_AFTER);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  function moveTop() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }

  return <div className={`floating-top${visible ? " visible" : ""}`} aria-hidden={!visible}>
    <button type="button" className="floating-top-btn" onClick={moveTop} tabIndex={visible ? 0 : -1} aria-label="최상단으로 이동" title="최상단으로 이동">
      <ArrowUpToLine aria-hidden="true" />
    </button>
  </div>;
}
