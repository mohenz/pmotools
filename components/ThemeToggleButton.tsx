"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// 상단 헤더 화면 모드 원클릭 전환(2026-10-02) — 설정 화면의 ThemeSelector와 같은 저장값(pmo-control-theme)을 쓴다.
//  - 지금 밝은 화면이면 다크로, 어두운 화면이면 화이트로 고정한다("시스템" 모드였다면 지금 보이는 모드의 반대로 고정).
//  - 아이콘은 CSS([data-theme])로 고른다 — head 스크립트가 그리기 전에 이미 테마를 정하므로 새로고침 때 아이콘이 반짝이지 않는다.
const STORAGE_KEY = "pmo-control-theme";
export const THEME_CHANGE_EVENT = "pmo-theme-change";

const currentTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function ThemeToggleButton() {
  const [label, setLabel] = useState("화면 모드 전환");

  useEffect(() => {
    const update = () => setLabel(currentTheme() === "dark" ? "화이트 모드로 전환" : "다크 모드로 전환");
    update();
    // 설정 화면(ThemeSelector)·시스템 모드 자동 전환으로 바뀌어도 안내 문구를 맞춘다.
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* 저장 불가 — 이번 화면만 바꾼다 */ }
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT)); // 설정 화면(ThemeSelector)이 열려 있으면 선택 표시를 맞춘다
  }

  return <button type="button" className="theme-toggle" aria-label={label} title={label} onClick={toggle}>
    <Moon className="theme-toggle-moon" aria-hidden="true" />
    <Sun className="theme-toggle-sun" aria-hidden="true" />
  </button>;
}
