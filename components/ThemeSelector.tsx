"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

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

export function ThemeSelector() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("pmo-control-theme");
    const initial = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    setPreference(initial);
    applyTheme(initial);
    setResolved(resolveTheme(initial));

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = () => {
      if ((localStorage.getItem("pmo-control-theme") ?? "system") === "system") {
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
    <div className="panel-head"><div><h2>화면 모드</h2><p>PMO CONTROL 전체 화면에 적용할 테마를 선택합니다.</p></div><span>현재 {resolved === "dark" ? "다크" : "화이트"} 모드</span></div>
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
