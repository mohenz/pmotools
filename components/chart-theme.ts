"use client";

import { useEffect, useRef } from "react";
import { Chart } from "chart.js";

export const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// 다크모드에서는 CSS 변수 계산값을 거치지 않고 확실히 밝은 리터럴 색을 바로 써서, 텍스트가 안 보이는 문제를 원천 차단한다.
export const isDarkTheme = () => document.documentElement.dataset.theme === "dark";
export const themeColor = (varName: string, darkFallback: string) => (isDarkTheme() ? darkFallback : cssVar(varName));

// 다크모드 전환(data-theme 변경) 시 CSS 변수 색상을 다시 읽어 차트를 재생성한다 — 이 프로젝트의 모든 chart.js 차트가 공유하는 훅.
export function useThemedChart(build: (canvas: HTMLCanvasElement) => Chart, deps: unknown[]) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function render() {
      chartRef.current?.destroy();
      chartRef.current = build(canvas!);
    }
    render();
    const observer = new MutationObserver(render);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      observer.disconnect();
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return canvasRef;
}
