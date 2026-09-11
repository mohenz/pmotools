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
  // head의 차단 스크립트가 마운트 전에 이미 올바른 테마를 적용해 두므로, 여기서도 첫 렌더부터 저장된
  // 값을 읽어야 한다. 이전엔 항상 기본값(화이트)으로 먼저 그렸다가 useEffect에서야 실제 값으로 고쳐써서,
  // 새로고침할 때마다 라디오 선택과 "현재 모드" 표시가 화이트로 한 프레임 반짝인 뒤 바뀌는 것처럼 보였다.
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  const [resolved, setResolved] = useState<"light" | "dark">(() => (typeof window === "undefined" ? "light" : resolveTheme(readPreference())));

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
