"use client";

import { useEffect, useRef } from "react";
import { ArcElement, BarController, BarElement, CategoryScale, Chart, DoughnutController, Legend, LinearScale, Tooltip } from "chart.js";

Chart.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, LinearScale, Tooltip, Legend);

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// 시스템 차트 기준(components/WbsStageChart.tsx)과 동일하게 다크모드 전환(data-theme 변경) 시 CSS 변수 색상을 다시 읽어 재렌더링한다.
function useThemedChart(build: (canvas: HTMLCanvasElement) => Chart, deps: unknown[]) {
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

export function WbsProgressChart({ planned, actual }: { planned: number; actual: number }) {
  const canvasRef = useThemedChart((canvas) => {
    const foreground = cssVar("--foreground"), muted = cssVar("--muted-foreground"), border = cssVar("--border"), card = cssVar("--card");
    const plannedColor = cssVar("--chart-planned"), actualColor = cssVar("--chart-actual");
    return new Chart(canvas, {
      type: "bar",
      data: {
        labels: ["공정율"],
        datasets: [
          { label: "계획", data: [Math.round(planned * 100)], backgroundColor: plannedColor, borderRadius: 4, maxBarThickness: 22 },
          { label: "실적", data: [Math.round(actual * 100)], backgroundColor: actualColor, borderRadius: 4, maxBarThickness: 22 },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true, maintainAspectRatio: false, animation: { duration: 200 },
        scales: {
          x: { min: 0, max: 100, grid: { color: border }, ticks: { color: muted, stepSize: 25, font: { size: 10 }, callback: (v) => `${v}%` } },
          y: { grid: { display: false }, ticks: { display: false } },
        },
        plugins: {
          legend: { position: "bottom", labels: { color: foreground, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "rectRounded", font: { size: 11 } } },
          tooltip: { backgroundColor: card, titleColor: foreground, bodyColor: foreground, borderColor: border, borderWidth: 1, padding: 8, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x}%` } },
        },
      },
    });
  }, [planned, actual]);
  return <div className="domain-chart"><canvas ref={canvasRef} role="img" aria-label={`WBS 계획 ${Math.round(planned * 100)}% 대비 실적 ${Math.round(actual * 100)}% 막대 그래프`} /></div>;
}

export function RequirementStatusChart({ accepted, partiallyAccepted, rejected }: { accepted: number; partiallyAccepted: number; rejected: number }) {
  const canvasRef = useThemedChart((canvas) => {
    const foreground = cssVar("--foreground"), border = cssVar("--border"), card = cssVar("--card");
    const success = cssVar("--success"), warning = cssVar("--warning"), destructive = cssVar("--destructive");
    return new Chart(canvas, {
      type: "doughnut",
      data: { labels: ["수용", "부분수용", "미수용"], datasets: [{ data: [accepted, partiallyAccepted, rejected], backgroundColor: [success, warning, destructive], borderColor: card, borderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 200 }, cutout: "62%",
        plugins: {
          legend: { position: "bottom", labels: { color: foreground, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "circle", font: { size: 11 } } },
          tooltip: { backgroundColor: card, titleColor: foreground, bodyColor: foreground, borderColor: border, borderWidth: 1, padding: 8 },
        },
      },
    });
  }, [accepted, partiallyAccepted, rejected]);
  return <div className="domain-chart"><canvas ref={canvasRef} role="img" aria-label={`요구사항 수용 ${accepted}건, 부분수용 ${partiallyAccepted}건, 미수용 ${rejected}건 도넛 그래프`} /></div>;
}

export function ManagementBandChart({ red, yellow, green }: { red: number; yellow: number; green: number }) {
  const canvasRef = useThemedChart((canvas) => {
    const foreground = cssVar("--foreground"), border = cssVar("--border"), card = cssVar("--card");
    const destructive = cssVar("--destructive"), warning = cssVar("--warning"), success = cssVar("--success");
    return new Chart(canvas, {
      type: "doughnut",
      data: { labels: ["위험", "주의", "양호"], datasets: [{ data: [red, yellow, green], backgroundColor: [destructive, warning, success], borderColor: card, borderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 200 }, cutout: "62%",
        plugins: {
          legend: { position: "bottom", labels: { color: foreground, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "circle", font: { size: 11 } } },
          tooltip: { backgroundColor: card, titleColor: foreground, bodyColor: foreground, borderColor: border, borderWidth: 1, padding: 8 },
        },
      },
    });
  }, [red, yellow, green]);
  return <div className="domain-chart"><canvas ref={canvasRef} role="img" aria-label={`관리업무 위험 ${red}건, 주의 ${yellow}건, 양호 ${green}건 도넛 그래프`} /></div>;
}
