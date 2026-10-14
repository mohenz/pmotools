"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_CHANGE_EVENT } from "@/components/ThemeToggleButton";

type ThemePreference = "light" | "dark" | "system";

const options: { value: ThemePreference; label: string; description: string; icon: typeof Sun }[] = [
  { value: "light", label: "화이트 모드", description: "항상 밝은 업무 화면을 사용합니다.", icon: Sun },
  { value: "dark", label: "다크 모드", description: "항상 어두운 업무 화면을 사용합니다.", icon: Moon },
  { value: "system", label: "시스템 모드", description: "운영체제의 화면 모드를 자동으로 따릅니다.", icon: Monitor },
];

function resolveTheme(preference: ThemePreference) {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

// 저장된 선택이 없을 때의 기본값. "시스템"으로 두면 OS의 다크모드 자동전환 스케줄을 따라가며
// 사용자가 고른 적 없는데도 화면이 갑자기 바뀌는 것처럼 보이는 문제가 있어, 명시적으로 고정한다.
const DEFAULT_THEME: ThemePreference = "light";

// localStorage는 서버에는 없으므로 SSR 시점엔 기본값을 쓰고, 브라우저에서만 실제 저장값을 읽는다.
function readPreference(): ThemePreference {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const saved = localStorage.getItem("pmo-control-theme");
  return saved === "light" || saved === "dark" || saved === "system" ? saved : DEFAULT_THEME;
}

export function ThemeSelector() {
  // 첫 렌더는 서버와 같은 기본값으로 그리고, 마운트 직후 저장값으로 맞춘다(2026-10-02).
  // 이전에는 첫 렌더부터 localStorage를 읽었는데, 저장값이 다크면 서버가 그린 "현재 화이트 모드" 글자와 달라
  // 화면 불일치(hydration) 오류가 나고 React가 <html>까지 다시 그리면서 head 스크립트가 넣은 data-theme가 지워졌다
  // (헤더 원클릭 전환으로 다크를 켠 뒤 설정 화면에 오면 화이트로 풀려 보임). 이 패널의 선택 표시만 한 번 바뀐다.
  const [preference, setPreference] = useState<ThemePreference>(DEFAULT_THEME);
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const sync = () => { const saved = readPreference(); setPreference(saved); setResolved(resolveTheme(saved)); };
    sync();
    window.addEventListener(THEME_CHANGE_EVENT, sync); // 상단 헤더 원클릭 전환과 맞춘다
    return () => window.removeEventListener(THEME_CHANGE_EVENT, sync);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = () => {
      if ((localStorage.getItem("pmo-control-theme") ?? DEFAULT_THEME) === "system") {
        applyTheme("system");
        setResolved(resolveTheme("system"));
      }
    };
    media.addEventListener("change", followSystem);
    return () => media.removeEventListener("change", followSystem);
  }, []);

  function selectTheme(next: ThemePreference) {
    localStorage.setItem("pmo-control-theme", next);
    setPreference(next);
    applyTheme(next);
    setResolved(resolveTheme(next));
  }

  return <section className="panel theme-settings-panel">
    <div className="panel-head"><div><h2>화면 모드</h2><p>PMOTOOLS 전체 화면에 적용할 테마를 선택합니다.</p></div><span>현재 {resolved === "dark" ? "다크" : "화이트"} 모드</span></div>
    <fieldset className="theme-options">
      <legend className="sr-only">화면 모드 선택</legend>
      {options.map((option) => <label className={`theme-option ${preference === option.value ? "selected" : ""}`} key={option.value}>
        <input type="radio" name="theme" value={option.value} checked={preference === option.value} onChange={() => selectTheme(option.value)} />
        <span className="theme-mark" aria-hidden="true"><option.icon /></span>
        <span><strong>{option.label}</strong><small>{option.description}</small></span>
      </label>)}
    </fieldset>
    <p className="theme-storage-note">선택한 모드는 현재 브라우저에 자동 저장됩니다.</p>
  </section>;
}
