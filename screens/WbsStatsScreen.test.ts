import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { WbsStatsScreen } from "./WbsStatsScreen";
import { WbsStatsScreen as MpWbsStatsScreen } from "./mp/WbsStatsScreen";
import type { WbsStats } from "@/lib/server/wbs";

// Mock WbsStageChart since it uses canvas and client chart.js
vi.mock("@/components/WbsStageChart", () => ({
  WbsStageChart: () => React.createElement("div", { "data-testid": "wbs-stage-chart" }),
}));

describe("WBS Stats Screens - 1 decimal place precision", () => {
  const mockStats: WbsStats = {
    overall: {
      planned: 0.8524,
      actual: 0.7245,
      progressIndex: 0.8499,
    },
    itemCount: 120,
    plannedCount: 102,
    actualCount: 87,
    scheduleProgress: 85,
    delayedCount: 5,
    delayTrackedCount: 95,
    delayRate: 0.05263,
    stages: [
      {
        stage: "요구분석",
        itemCount: 20,
        planned: 1.0,
        actual: 1.0,
        plannedCount: 20,
        actualCount: 20,
        scheduleProgress: 100,
        delayedCount: 0,
        delayTrackedCount: 20,
        delayRate: 0,
        delayed: false,
      },
      {
        stage: "설계",
        itemCount: 40,
        planned: 0.6,
        actual: 0.5,
        plannedCount: 24,
        actualCount: 20,
        scheduleProgress: 83,
        delayedCount: 3,
        delayTrackedCount: 24,
        delayRate: 0.125,
        delayed: true,
      },
      {
        stage: "개발",
        itemCount: 60,
        planned: 0.0,
        actual: 0.0,
        plannedCount: 0,
        actualCount: 0,
        scheduleProgress: 0,
        delayedCount: 0,
        delayTrackedCount: 0,
        delayRate: 0,
        delayed: false,
      },
    ],
  };

  it("renders WbsStatsScreen KPI metrics with 1 decimal place", () => {
    const rawHtml = renderToString(React.createElement(WbsStatsScreen, { stats: mockStats }));
    const html = rawHtml.replace(/<!-- -->/g, "");

    // 예상공정율: 0.8524 * 100 -> 85.2%
    expect(html).toContain("<span>예상공정율</span><strong>85.2%</strong>");

    // 공정율: 0.7245 * 100 -> 72.5%
    expect(html).toContain("<span>공정율</span><strong>72.5%</strong>");

    // 진척율: 0.8499 * 100 -> 85.0%
    expect(html).toContain("<span>진척율</span><strong class=\"critical\">85.0%</strong>");

    // 전체 지연율: 0.05263 * 100 -> 5.3%
    expect(html).toContain("<span>전체 지연율</span><strong class=\"critical\">5.3%</strong>");

    // Stage 1 (요구분석): 100.0%, 100.0%, 100.0%, 0.0%
    expect(html).toContain("<td data-numeric=\"true\">100.0%</td>");

    // Stage 2 (설계): 진척율 (0.5 / 0.6 = 83.3%), 예상 (60.0%), 실적 (50.0%), 지연율 (12.5%)
    expect(html).toContain("<td data-numeric=\"true\">83.3%</td>");
    expect(html).toContain("<td data-numeric=\"true\">60.0%</td>");
    expect(html).toContain("<td data-numeric=\"true\">50.0%</td>");
    expect(html).toContain("<td data-numeric=\"true\" class=\"critical\">12.5%</td>");

    // Stage 3 (개발): 0.0%, 0.0%, 0.0%, 0.0%
    expect(html).toContain("<td data-numeric=\"true\">0.0%</td>");

    // Footer totals row: 진척율 (85.0%), 예상 (85.2%), 실적 (72.5%), 지연율 (5.3%)
    expect(html).toContain("<tr class=\"totals-row\">");
  });

  it("renders mp/WbsStatsScreen with identical 1 decimal place precision", () => {
    const rawHtml = renderToString(React.createElement(MpWbsStatsScreen, { stats: mockStats as any }));
    const html = rawHtml.replace(/<!-- -->/g, "");

    expect(html).toContain("<span>예상공정율</span><strong>85.2%</strong>");
    expect(html).toContain("<span>공정율</span><strong>72.5%</strong>");
    expect(html).toContain("<span>진척율</span><strong class=\"critical\">85.0%</strong>");
    expect(html).toContain("<span>전체 지연율</span><strong class=\"critical\">5.3%</strong>");
    expect(html).toContain("<td data-numeric=\"true\">83.3%</td>");
    expect(html).toContain("<td data-numeric=\"true\">60.0%</td>");
    expect(html).toContain("<td data-numeric=\"true\">50.0%</td>");
  });
});
