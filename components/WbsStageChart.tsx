"use client";

import { useEffect, useRef } from "react";
import { BarController, BarElement, CategoryScale, Chart, Legend, LinearScale, Tooltip } from "chart.js";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export type WbsStageChartDatum = { stage: string; planned: number; actual: number; delayed: boolean };

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function WbsStageChart({ stages }: { stages: WbsStageChartDatum[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function render() {
      const foreground = cssVar("--foreground");
      const muted = cssVar("--muted-foreground");
      const border = cssVar("--border");
      const card = cssVar("--card");
      const planned = cssVar("--chart-planned");
      const actual = cssVar("--chart-actual");
      const destructive = cssVar("--destructive");

      chartRef.current?.destroy();
      chartRef.current = new Chart(canvas!, {
        type: "bar",
        data: {
          labels: stages.map((s) => (s.delayed ? `⚠ ${s.stage}` : s.stage)),
          datasets: [
            { label: "계획", data: stages.map((s) => Math.round(s.planned * 100)), backgroundColor: planned, borderRadius: 4, maxBarThickness: 24 },
            { label: "실적", data: stages.map((s) => Math.round(s.actual * 100)), backgroundColor: actual, borderRadius: 4, maxBarThickness: 24 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 200 },
          scales: {
            x: { grid: { display: false }, ticks: { color: (ctx) => (stages[ctx.index]?.delayed ? destructive : muted), font: { size: 11 } } },
            y: { min: 0, max: 100, grid: { color: border }, ticks: { color: muted, stepSize: 20, callback: (value) => `${value}%` } },
          },
          plugins: {
            legend: { position: "top", align: "end", labels: { color: foreground, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "rectRounded" } },
            tooltip: {
              backgroundColor: card, titleColor: foreground, bodyColor: foreground, borderColor: border, borderWidth: 1, padding: 8,
              callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%` },
            },
          },
        },
      });
    }

    render();
    const observer = new MutationObserver(render);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      observer.disconnect();
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [stages]);

  return <div className="wbs-stage-chart"><canvas ref={canvasRef} role="img" aria-label="Stage별 계획 대비 실적 공정율 막대 그래프. 아래 표에 동일한 수치가 있습니다." /></div>;
}
