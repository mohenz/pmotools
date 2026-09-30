"use client";

import { ArcElement, BarController, BarElement, CategoryScale, Chart, DoughnutController, Legend, LinearScale, Tooltip, type ChartType, type LegendItem } from "chart.js";
import { cssVar, isDarkTheme, themeColor, useThemedChart } from "@/components/chart-theme";

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
// 나의 WBS 현황 카드는 한 줄짜리 누적 막대라 큰 높이가 필요 없다.
const MY_WBS_STATUS_CHART_HEIGHT = 140;

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
                { text: "계획", fillStyle: plannedColor, strokeStyle: plannedColor, fontColor: foreground, pointStyle: "rect", index: 0 },
                { text: "완료", fillStyle: actualColor, strokeStyle: actualColor, fontColor: foreground, pointStyle: "rect", index: 1 },
                { text: "지연", fillStyle: destructiveColor, strokeStyle: destructiveColor, fontColor: foreground, pointStyle: "rect", index: 2 },
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

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    const radii = typeof r === "number" ? [r, r, r, r] : [r[0] || 0, r[1] || 0, r[2] || 0, r[3] || 0];
    const [tl, tr, br, bl] = radii;
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    ctx.lineTo(x + bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
    ctx.lineTo(x, y + tl);
    ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
  }
}

// 나의 WBS 현황: 10% 단위(10-Segment Block)로 채워지는 chart.js 기반 게이지형 배터리 그래프
export function WbsOwnerStatusChart({ completed, inProgress, delayed }: { completed: number; inProgress: number; delayed: number }) {
  const canvasRef = useThemedChart((canvas) => {
    const isDark = isDarkTheme();
    const foreground = themeColor("--foreground", "#ffffff");
    const muted = themeColor("--muted-foreground", "#94a3b8");
    const border = cssVar("--border");
    const card = cssVar("--card");
    const mono = cssVar("--font-mono");
    const success = cssVar("--chart-success") || "#22c55e";
    const plannedColor = cssVar("--chart-planned") || "#3b82f6";
    const destructive = cssVar("--chart-destructive") || "#ef4444";
    const casingBorder = isDark ? "#64748b" : "#94a3b8";
    const casingBg = isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)";
    const emptyCellBg = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)";
    const emptyCellBorder = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.1)";

    const total = completed + inProgress + delayed;
    const maxVal = Math.max(total, 1);
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    // 10칸(10% 단위) 중 각 상태별 할당 칸 수 연산
    let compCells = total > 0 ? Math.round((completed / total) * 10) : 0;
    if (completed > 0 && compCells === 0) compCells = 1;
    let delCells = total > 0 ? Math.round((delayed / total) * 10) : 0;
    if (delayed > 0 && delCells === 0) delCells = 1;
    let progCells = total > 0 ? Math.round((inProgress / total) * 10) : 0;
    if (inProgress > 0 && progCells === 0) progCells = 1;

    while (compCells + progCells + delCells > 10) {
      if (progCells > 1) progCells--;
      else if (delCells > 1) delCells--;
      else if (compCells > 1) compCells--;
      else break;
    }

    const batteryPlugin = {
      id: "tenSegmentBattery",
      afterDatasetsDraw(chart: Chart) {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const yScale = chart.scales.y;
        if (!yScale) return;
        const yCenter = yScale.getPixelForValue(0);
        const bodyHeight = 44;
        const bodyTop = yCenter - bodyHeight / 2;
        const bodyLeft = chartArea.left;
        const bodyWidth = chartArea.right - chartArea.left;

        ctx.save();

        // 1. 배터리 본체 쉘 배경
        ctx.beginPath();
        drawRoundRect(ctx, bodyLeft, bodyTop, bodyWidth, bodyHeight, 8);
        ctx.fillStyle = casingBg;
        ctx.fill();

        // 2. 우측 양극 단자 캡 (Terminal Cap)
        const tipWidth = 8;
        const tipHeight = 20;
        const tipX = chartArea.right + 2;
        const tipY = yCenter - tipHeight / 2;
        ctx.beginPath();
        drawRoundRect(ctx, tipX, tipY, tipWidth, tipHeight, [0, 4, 4, 0]);
        ctx.fillStyle = casingBorder;
        ctx.fill();

        // 3. 10% 단위 10개 독립 세그먼트 셀 (10-Segment Cells) 렌더링
        const NUM_CELLS = 10;
        const padX = 6;
        const padY = 5;
        const innerX = bodyLeft + padX;
        const innerY = bodyTop + padY;
        const innerW = bodyWidth - padX * 2;
        const innerH = bodyHeight - padY * 2;
        const gap = innerW > 600 ? 4 : 3;
        const cellW = (innerW - gap * (NUM_CELLS - 1)) / NUM_CELLS;

        for (let i = 0; i < NUM_CELLS; i++) {
          const cX = innerX + i * (cellW + gap);
          const cY = innerY;
          const isFirst = i === 0;
          const isLast = i === NUM_CELLS - 1;
          const radii: number[] = isFirst ? [4, 2, 2, 4] : isLast ? [2, 4, 4, 2] : [2, 2, 2, 2];

          // 상태별 셀 색상 결정
          let cellColor: string;
          let isFilled = false;
          if (i < compCells) {
            cellColor = success;
            isFilled = true;
          } else if (i < compCells + progCells) {
            cellColor = plannedColor;
            isFilled = true;
          } else if (i < compCells + progCells + delCells) {
            cellColor = destructive;
            isFilled = true;
          } else {
            cellColor = emptyCellBg;
            isFilled = false;
          }

          // 셀 그리기
          ctx.beginPath();
          drawRoundRect(ctx, cX, cY, cellW, innerH, radii);
          ctx.fillStyle = cellColor;
          ctx.fill();

          if (!isFilled) {
            // 빈 셀은 옅은 테두리 선으로 10칸 슬롯 형태 유지
            ctx.strokeStyle = emptyCellBorder;
            ctx.lineWidth = 1;
            ctx.stroke();
          } else {
            // 채워진 셀에 미세한 상단 입체 하이라이트 부여
            ctx.save();
            ctx.beginPath();
            drawRoundRect(ctx, cX, cY, cellW, Math.max(3, innerH * 0.3), [radii[0], radii[1], 0, 0]);
            ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
            ctx.fill();
            ctx.restore();
          }
        }

        // 4. 배터리 본체 외곽 테두리 (2.5px 둥근 모서리)
        ctx.beginPath();
        drawRoundRect(ctx, bodyLeft, bodyTop, bodyWidth, bodyHeight, 8);
        ctx.strokeStyle = casingBorder;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 5. 중앙 충전율(%) 및 건수 텍스트 오버레이 (고대비 배지 처리)
        const centerX = bodyLeft + bodyWidth / 2;
        const text = total > 0 ? `${completionPct}% (${completed}/${total}건)` : "0% (0건)";
        ctx.font = `700 13px ${mono || "ui-monospace, monospace"}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // 텍스트 배경 섀도우를 주어 블록 색상 위에서도 100% 선명하게 읽히도록 보장
        ctx.shadowColor = isDark ? "rgba(0, 0, 0, 0.9)" : "rgba(255, 255, 255, 0.95)";
        ctx.shadowBlur = 5;
        ctx.fillStyle = foreground;
        ctx.fillText(text, centerX, yCenter);

        ctx.restore();
      },
    };

    return new Chart(canvas, {
      type: "bar",
      data: {
        labels: [""],
        datasets: [
          // 기본 바는 투명하게 처리하여 10개 세그먼트 셀이 돋보이게 하고, Chart.js 툴팁/범례 인터랙션 유지
          { label: "완료", data: [completed], backgroundColor: "transparent", barThickness: 34 },
          { label: "진행중", data: [inProgress], backgroundColor: "transparent", barThickness: 34 },
          { label: "지연", data: [delayed], backgroundColor: "transparent", barThickness: 34 },
        ],
      },
      plugins: [batteryPlugin],
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        layout: {
          padding: {
            left: 12,
            right: 28, // 우측 배터리 캡을 위한 여백 확보
            top: 14,
            bottom: 6,
          },
        },
        scales: {
          x: {
            stacked: true,
            min: 0,
            max: maxVal,
            grid: { display: false },
            ticks: { display: false },
            border: { display: false },
          },
          y: {
            stacked: true,
            grid: { display: false },
            ticks: { display: false },
            border: { display: false },
          },
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: foreground,
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
              pointStyle: "rect",
              font: { size: 11 },
              generateLabels: () => [
                { text: `완료 ${completed}건 (${compCells * 10}%)`, fillStyle: success, strokeStyle: success, fontColor: foreground, pointStyle: "rect", index: 0 },
                { text: `진행중 ${inProgress}건 (${progCells * 10}%)`, fillStyle: plannedColor, strokeStyle: plannedColor, fontColor: foreground, pointStyle: "rect", index: 1 },
                { text: `지연 ${delayed}건 (${delCells * 10}%)`, fillStyle: destructive, strokeStyle: destructive, fontColor: foreground, pointStyle: "rect", index: 2 },
              ],
            },
          },
          tooltip: {
            backgroundColor: card,
            titleColor: foreground,
            bodyColor: foreground,
            borderColor: border,
            borderWidth: 1,
            padding: 8,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x}건 (${total > 0 ? Math.round(((ctx.parsed.x as number) / total) * 100) : 0}%)`,
            },
          },
        },
      },
    });
  }, [completed, inProgress, delayed]);

  const total = completed + inProgress + delayed;
  const pctText = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="domain-chart" style={{ height: MY_WBS_STATUS_CHART_HEIGHT }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`나의 WBS 현황 10단계 게이지 배터리 그래프: 완료 ${completed}건, 진행중 ${inProgress}건, 지연 ${delayed}건, 충전율 ${pctText}%`}
      />
    </div>
  );
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
