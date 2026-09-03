"use client";

import { ArcElement, BarController, BarElement, CategoryScale, Chart, DoughnutController, Legend, LinearScale, Tooltip, type ChartType, type LegendItem } from "chart.js";
import { cssVar, themeColor, useThemedChart } from "@/components/chart-theme";

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

// usePointStyle:true인 범례는 항목별 LegendItem.pointStyle을 직접 읽는다 — 여기서 빠뜨리면
// labels.pointStyle 전역 설정과 무관하게 기본값(원)으로 그려지므로, 아래 두 헬퍼 모두 호출한 쪽이
// 실제 쓰는 도형을 그대로 넘겨받아 채워 넣는다.
type PointStyle = NonNullable<LegendItem["pointStyle"]>;

// 범례에 항목명만이 아니라 실제 건수(테스크수 등)를 함께 표기해, 차트로 바꾼 뒤에도 숫자가 항상 보이게 한다.
// 도넛(단일 데이터셋, 슬라이스별 배열 색상)용 — chart.data.labels 기준으로 순회한다.
function countLegend(unit: string, pointStyle: PointStyle) {
  return (chart: Chart): LegendItem[] => {
    const { labels = [], datasets } = chart.data;
    const colors = (datasets[0]?.backgroundColor ?? []) as string[];
    const values = (datasets[0]?.data ?? []) as number[];
    return labels.map((label, i) => ({ text: `${label as string} ${values[i] ?? 0}${unit}`, fillStyle: colors[i] ?? "", strokeStyle: colors[i] ?? "", pointStyle, index: i }));
  };
}

export type WbsStageProgress = { stage: string; planned: number; actual: number; delayed: boolean };

// WBS 진척 카드(Stage별 막대 그래프)의 고정 높이.
const DOMAIN_CHART_HEIGHT = 260;

// Stage별로 한 줄씩 — 계획 대비 실적을 겹쳐 그린 불릿 막대 한 줄에 담아, Stage 전체 진행 상태를 한 화면에서 보여준다.
export function WbsProgressChart({ stages }: { stages: WbsStageProgress[] }) {
  const canvasRef = useThemedChart((canvas) => {
    const foreground = themeColor("--foreground", "#ffffff"), muted = themeColor("--muted-foreground", "#d4d4d4"), border = cssVar("--border"), card = cssVar("--card");
    const plannedColor = cssVar("--chart-planned"), actualColor = cssVar("--chart-actual"), destructiveColor = cssVar("--chart-destructive");
    const labels = stages.map((s) => s.stage);
    const plannedPct = stages.map((s) => Math.round(s.planned * 100));
    const actualPct = stages.map((s) => Math.round(s.actual * 100));
    const actualColors = stages.map((s) => (s.delayed ? destructiveColor : actualColor));
    return new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          // grouped: false로 두 데이터셋을 같은 x축 위치에 겹쳐 그린다 — 배열 앞쪽이 위로 그려지므로 실적을 먼저, 계획을 배경으로 나중에 넣는다.
          { label: "실적", data: actualPct, backgroundColor: actualColors, borderRadius: 3, maxBarThickness: 26, grouped: false },
          { label: "계획", data: plannedPct, backgroundColor: plannedColor, borderRadius: 3, maxBarThickness: 26, grouped: false },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 200 },
        scales: {
          x: { grid: { display: false }, ticks: { color: foreground, font: { size: 11, weight: 600 }, maxRotation: 60, minRotation: 60 } },
          y: { min: 0, max: 100, grid: { color: border }, ticks: { color: muted, stepSize: 25, font: { size: 10 }, callback: (v) => `${v}%` } },
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: foreground, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "rect", font: { size: 11 },
              generateLabels: () => [
                { text: "계획", fillStyle: plannedColor, strokeStyle: plannedColor, pointStyle: "rect", index: 0 },
                { text: "완료", fillStyle: actualColor, strokeStyle: actualColor, pointStyle: "rect", index: 1 },
                { text: "지연", fillStyle: destructiveColor, strokeStyle: destructiveColor, pointStyle: "rect", index: 2 },
              ],
            },
          },
          tooltip: {
            backgroundColor: card, titleColor: foreground, bodyColor: foreground, borderColor: border, borderWidth: 1, padding: 8,
            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%`, afterLabel: (ctx) => (ctx.datasetIndex === 0 ? (stages[ctx.dataIndex].delayed ? "지연" : "완료") : "") },
          },
        },
      },
    });
  }, [stages]);
  return <div className="domain-chart" style={{ height: DOMAIN_CHART_HEIGHT }}><canvas ref={canvasRef} role="img" aria-label={`Stage별 계획 대비 실적 막대 그래프, ${stages.length}개 Stage`} /></div>;
}

export function WbsOwnerStatusChart({ completed, inProgress, delayed }: { completed: number; inProgress: number; delayed: number }) {
  const canvasRef = useThemedChart((canvas) => {
    const foreground = themeColor("--foreground", "#ffffff"), muted = themeColor("--muted-foreground", "#d4d4d4"), border = cssVar("--border"), card = cssVar("--card");
    const success = cssVar("--chart-success"), plannedColor = cssVar("--chart-planned"), destructive = cssVar("--chart-destructive");
    return new Chart(canvas, {
      type: "bar",
      data: {
        labels: ["완료", "진행중", "지연"],
        datasets: [{ data: [completed, inProgress, delayed], backgroundColor: [success, plannedColor, destructive], borderRadius: 4, maxBarThickness: 40 }],
      },
      options: {
        indexAxis: "y",
        responsive: true, maintainAspectRatio: false, animation: { duration: 200 },
        scales: {
          x: { beginAtZero: true, grid: { color: border }, ticks: { color: muted, precision: 0, font: { size: 10 } } },
          y: { grid: { display: false }, ticks: { color: foreground, font: { size: 12, weight: 600 } } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: card, titleColor: foreground, bodyColor: foreground, borderColor: border, borderWidth: 1, padding: 8, callbacks: { label: (ctx) => `${ctx.parsed.x}건` } },
        },
      },
    });
  }, [completed, inProgress, delayed]);
  return <div className="domain-chart" style={{ height: DOMAIN_CHART_HEIGHT }}><canvas ref={canvasRef} role="img" aria-label={`나의 WBS 현황 완료 ${completed}건, 진행중 ${inProgress}건, 지연 ${delayed}건 가로 막대 그래프`} /></div>;
}

export function ManagementBandChart({ red, yellow, green }: { red: number; yellow: number; green: number }) {
  const canvasRef = useThemedChart((canvas) => {
    const foreground = cssVar("--foreground"), muted = cssVar("--muted-foreground"), border = cssVar("--border"), card = cssVar("--card"), mono = cssVar("--font-mono");
    const destructive = cssVar("--chart-destructive"), warning = cssVar("--chart-warning"), success = cssVar("--chart-success");
    const total = red + yellow + green;
    return new Chart(canvas, {
      type: "doughnut",
      data: { labels: ["위험", "주의", "양호"], datasets: [{ data: [red, yellow, green], backgroundColor: [destructive, warning, success], borderColor: card, borderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 200 }, cutout: "62%",
        plugins: {
          centerText: { text: `${total}`, subtext: "건", color: foreground, subColor: muted, font: mono },
          legend: { position: "bottom", labels: { color: foreground, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "circle", font: { size: 11 }, generateLabels: countLegend("건", "circle") } },
          tooltip: { backgroundColor: card, titleColor: foreground, bodyColor: foreground, borderColor: border, borderWidth: 1, padding: 8 },
        },
      },
    });
  }, [red, yellow, green]);
  return <div className="domain-chart"><canvas ref={canvasRef} role="img" aria-label={`관리업무 위험 ${red}건, 주의 ${yellow}건, 양호 ${green}건 도넛 그래프`} /></div>;
}
