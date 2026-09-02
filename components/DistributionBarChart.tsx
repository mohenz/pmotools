"use client";

import { useRouter } from "next/navigation";
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip, type ChartEvent, type ActiveElement } from "chart.js";
import { cssVar, themeColor, useThemedChart } from "@/components/chart-theme";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

export type DistributionRow = { label: string; count: number; href?: string };

// 항목별 건수를 1열 가로 막대로 보여준다 — href가 있으면 막대를 눌러 필터링된 목록으로 이동한다.
export function DistributionBarChart({ rows, unit = "건" }: { rows: DistributionRow[]; unit?: string }) {
  const router = useRouter();
  const canvasRef = useThemedChart((canvas) => {
    const foreground = themeColor("--foreground", "#ffffff");
    const muted = themeColor("--muted-foreground", "#d4d4d4");
    const border = cssVar("--border");
    const card = cssVar("--card");
    const barColor = cssVar("--chart-planned");
    const max = Math.max(1, ...rows.map((row) => row.count));

    return new Chart(canvas, {
      type: "bar",
      data: {
        labels: rows.map((row) => row.label),
        datasets: [{ data: rows.map((row) => row.count), backgroundColor: barColor, borderRadius: 4, maxBarThickness: 22 }],
      },
      options: {
        indexAxis: "y",
        responsive: true, maintainAspectRatio: false, animation: { duration: 200 },
        onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
          const href = elements[0] ? rows[elements[0].index]?.href : undefined;
          if (href) router.push(href);
        },
        onHover: (event, elements) => {
          const target = event.native?.target as HTMLElement | undefined;
          if (target) target.style.cursor = elements.length && rows[elements[0].index]?.href ? "pointer" : "default";
        },
        scales: {
          x: { min: 0, max, grid: { color: border }, ticks: { color: muted, font: { size: 10 }, precision: 0 } },
          y: { grid: { display: false }, ticks: { color: foreground, font: { size: 11 } } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: card, titleColor: foreground, bodyColor: foreground, borderColor: border, borderWidth: 1, padding: 8,
            callbacks: { label: (ctx) => `${ctx.parsed.x}${unit}` },
          },
        },
      },
    });
  }, [rows, unit]);
  const height = Math.max(120, rows.length * 30 + 30);
  return <div className="domain-chart" style={{ height }}><canvas ref={canvasRef} role="img" aria-label={`${rows.map((row) => `${row.label} ${row.count}${unit}`).join(", ")} 막대 그래프`} /></div>;
}
