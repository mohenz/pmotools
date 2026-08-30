"use client";

import { useEffect, useRef } from "react";
import { ArcElement, BarController, BarElement, CategoryScale, Chart, DoughnutController, Legend, LinearScale, Tooltip, type ChartType, type LegendItem } from "chart.js";

type CenterTextOptions = { text: string; subtext?: string; color: string; subColor: string; font: string };
declare module "chart.js" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType extends ChartType> {
    centerText?: CenterTextOptions;
  }
}

// 도넛 차트 중앙에 총 건수를 그려 넣는 커스텀 플러그인 — chart.options.plugins.centerText로 설정을 전달한다.
const centerTextPlugin = {
  id: "centerText",
  afterDraw(chart: Chart) {
    const opts = chart.options.plugins?.centerText;
    if (!opts?.text) return;
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const centerX = (chartArea.left + chartArea.right) / 2;
    const centerY = (chartArea.top + chartArea.bottom) / 2;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = opts.color ?? "#000";
    ctx.font = `700 22px ${opts.font}`;
    ctx.fillText(opts.text, centerX, centerY - (opts.subtext ? 9 : 0));
    if (opts.subtext) {
      ctx.font = `600 10px ${opts.font}`;
      ctx.fillStyle = opts.subColor ?? opts.color ?? "#000";
      ctx.fillText(opts.subtext, centerX, centerY + 11);
    }
    ctx.restore();
  },
};

Chart.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, LinearScale, Tooltip, Legend, centerTextPlugin);

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

// 범례에 항목명만이 아니라 실제 건수(테스크수 등)를 함께 표기해, 차트로 바꾼 뒤에도 숫자가 항상 보이게 한다.
function countLegend(unit: string) {
  return (chart: Chart): LegendItem[] => {
    const { labels = [], datasets } = chart.data;
    const colors = (datasets[0]?.backgroundColor ?? []) as string[];
    const values = (datasets[0]?.data ?? []) as number[];
    return labels.map((label, i) => ({ text: `${label as string} ${values[i] ?? 0}${unit}`, fillStyle: colors[i] ?? "", strokeStyle: colors[i] ?? "", index: i }));
  };
}

export function WbsProgressChart({ planned, actual }: { planned: number; actual: number }) {
  const canvasRef = useThemedChart((canvas) => {
    const foreground = cssVar("--foreground"), muted = cssVar("--muted-foreground"), border = cssVar("--border"), card = cssVar("--card");
    const plannedColor = cssVar("--chart-planned"), actualColor = cssVar("--chart-actual");
    const plannedPct = Math.round(planned * 100), actualPct = Math.round(actual * 100);
    return new Chart(canvas, {
      type: "bar",
      data: {
        labels: ["공정율"],
        datasets: [
          { label: "계획", data: [plannedPct], backgroundColor: plannedColor, borderRadius: 4, maxBarThickness: 22 },
          { label: "실적", data: [actualPct], backgroundColor: actualColor, borderRadius: 4, maxBarThickness: 22 },
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
          legend: {
            position: "bottom",
            labels: {
              color: foreground, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "rectRounded", font: { size: 11 },
              generateLabels: (chart) => chart.data.datasets.map((ds, i) => ({ text: `${ds.label} ${(ds.data[0] as number)}%`, fillStyle: ds.backgroundColor as string, strokeStyle: ds.backgroundColor as string, index: i })),
            },
          },
          tooltip: { backgroundColor: card, titleColor: foreground, bodyColor: foreground, borderColor: border, borderWidth: 1, padding: 8, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x}%` } },
        },
      },
    });
  }, [planned, actual]);
  return <div className="domain-chart"><canvas ref={canvasRef} role="img" aria-label={`WBS 계획 ${Math.round(planned * 100)}% 대비 실적 ${Math.round(actual * 100)}% 막대 그래프`} /></div>;
}

export function RequirementStatusChart({ accepted, partiallyAccepted, rejected }: { accepted: number; partiallyAccepted: number; rejected: number }) {
  const canvasRef = useThemedChart((canvas) => {
    const foreground = cssVar("--foreground"), muted = cssVar("--muted-foreground"), border = cssVar("--border"), card = cssVar("--card"), mono = cssVar("--font-mono");
    const success = cssVar("--success"), warning = cssVar("--warning"), destructive = cssVar("--destructive");
    const total = accepted + partiallyAccepted + rejected;
    return new Chart(canvas, {
      type: "doughnut",
      data: { labels: ["수용", "부분수용", "미수용"], datasets: [{ data: [accepted, partiallyAccepted, rejected], backgroundColor: [success, warning, destructive], borderColor: card, borderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 200 }, cutout: "62%",
        plugins: {
          centerText: { text: `${total}`, subtext: "건", color: foreground, subColor: muted, font: mono },
          legend: { position: "bottom", labels: { color: foreground, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "circle", font: { size: 11 }, generateLabels: countLegend("건") } },
          tooltip: { backgroundColor: card, titleColor: foreground, bodyColor: foreground, borderColor: border, borderWidth: 1, padding: 8 },
        },
      },
    });
  }, [accepted, partiallyAccepted, rejected]);
  return <div className="domain-chart"><canvas ref={canvasRef} role="img" aria-label={`요구사항 수용 ${accepted}건, 부분수용 ${partiallyAccepted}건, 미수용 ${rejected}건 도넛 그래프`} /></div>;
}

export function ManagementBandChart({ red, yellow, green }: { red: number; yellow: number; green: number }) {
  const canvasRef = useThemedChart((canvas) => {
    const foreground = cssVar("--foreground"), muted = cssVar("--muted-foreground"), border = cssVar("--border"), card = cssVar("--card"), mono = cssVar("--font-mono");
    const destructive = cssVar("--destructive"), warning = cssVar("--warning"), success = cssVar("--success");
    const total = red + yellow + green;
    return new Chart(canvas, {
      type: "doughnut",
      data: { labels: ["위험", "주의", "양호"], datasets: [{ data: [red, yellow, green], backgroundColor: [destructive, warning, success], borderColor: card, borderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 200 }, cutout: "62%",
        plugins: {
          centerText: { text: `${total}`, subtext: "건", color: foreground, subColor: muted, font: mono },
          legend: { position: "bottom", labels: { color: foreground, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "circle", font: { size: 11 }, generateLabels: countLegend("건") } },
          tooltip: { backgroundColor: card, titleColor: foreground, bodyColor: foreground, borderColor: border, borderWidth: 1, padding: 8 },
        },
      },
    });
  }, [red, yellow, green]);
  return <div className="domain-chart"><canvas ref={canvasRef} role="img" aria-label={`관리업무 위험 ${red}건, 주의 ${yellow}건, 양호 ${green}건 도넛 그래프`} /></div>;
}
