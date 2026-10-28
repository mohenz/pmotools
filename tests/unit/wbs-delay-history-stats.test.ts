import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { aggregateDelayedTaskStats } from "@/lib/server/wbs";
import { WbsDelayHistoryTabs } from "@/components/WbsDelayHistoryTabs";
import { WbsDelayHistoryStatsScreen } from "@/screens/WbsDelayHistoryStatsScreen";
import { WbsDelayHistoryStatsScreen as MpWbsDelayHistoryStatsScreen } from "@/screens/mp/WbsDelayHistoryStatsScreen";

describe("WBS Delay History Statistics & Internal Tabs", () => {
  describe("aggregateDelayedTaskStats", () => {
    it("handles empty rows correctly without divide-by-zero errors", () => {
      const stats = aggregateDelayedTaskStats([]);
      expect(stats.totalCount).toBe(0);
      expect(stats.totalDelayDays).toBe(0);
      expect(stats.avgDelayDays).toBe(0);
      expect(stats.maxDelayDays).toBe(0);
      expect(stats.affectedOwnersCount).toBe(0);
      expect(stats.affectedGroupsCount).toBe(0);
      expect(stats.rangeDistribution).toHaveLength(4);
      expect(stats.rangeDistribution.every((r) => r.count === 0 && r.countRate === 0)).toBe(true);
      expect(stats.groupStats).toEqual([]);
      expect(stats.ownerStats).toEqual([]);
      expect(stats.monthlyTrend).toEqual([]);
      expect(stats.topDelayedTasks).toEqual([]);
    });

    it("correctly aggregates delay metrics, ranges, groups, owners, and trends", () => {
      const sampleRows = [
        {
          id: "delay-1",
          wbsItemId: "item-1",
          name: "결제 모듈 단위 테스트",
          plannedDueDate: new Date("2026-10-05T00:00:00.000Z"),
          actualDueDate: new Date("2026-10-07T00:00:00.000Z"),
          delayDays: 2, // 1~3일 (경미)
          groupLabel: "결제",
          ownerName: "홍길동",
          createdAt: new Date("2026-10-07T10:00:00.000Z"),
          wbsItem: { path: "0001.0002" },
        },
        {
          id: "delay-2",
          wbsItemId: "item-2",
          name: "주문 API 연동",
          plannedDueDate: new Date("2026-10-01T00:00:00.000Z"),
          actualDueDate: new Date("2026-10-06T00:00:00.000Z"),
          delayDays: 5, // 4~7일 (주의)
          groupLabel: "온라인채널",
          ownerName: "김철수",
          createdAt: new Date("2026-10-06T14:30:00.000Z"),
          wbsItem: { path: "0001.0003" },
        },
        {
          id: "delay-3",
          wbsItemId: "item-3",
          name: "정산 인터페이스 배치",
          plannedDueDate: new Date("2026-09-10T00:00:00.000Z"),
          actualDueDate: new Date("2026-09-20T00:00:00.000Z"),
          delayDays: 10, // 8~14일 (경고)
          groupLabel: "결제",
          ownerName: "홍길동",
          createdAt: new Date("2026-09-20T17:00:00.000Z"),
          wbsItem: { path: "0002.0001" },
        },
        {
          id: "delay-4",
          wbsItemId: "item-4",
          name: "회원 인증 SSO 개편",
          plannedDueDate: new Date("2026-09-01T00:00:00.000Z"),
          actualDueDate: new Date("2026-09-25T00:00:00.000Z"),
          delayDays: 18, // 15일 이상 (심각)
          groupLabel: "공통",
          ownerName: "이영희",
          createdAt: new Date("2026-09-25T09:15:00.000Z"),
          wbsItem: { path: "0003.0001" },
        },
      ];

      const stats = aggregateDelayedTaskStats(sampleRows);

      // KPI Checks
      expect(stats.totalCount).toBe(4);
      expect(stats.totalDelayDays).toBe(35); // 2 + 5 + 10 + 18 = 35
      expect(stats.avgDelayDays).toBe(8.8); // 35 / 4 = 8.75 -> 8.8
      expect(stats.maxDelayDays).toBe(18);
      expect(stats.affectedOwnersCount).toBe(3); // 홍길동, 김철수, 이영희
      expect(stats.affectedGroupsCount).toBe(3); // 결제, 온라인채널, 공통

      // Range distribution checks
      expect(stats.rangeDistribution).toHaveLength(4);
      const minor = stats.rangeDistribution.find((r) => r.range === "1~3일");
      const moderate = stats.rangeDistribution.find((r) => r.range === "4~7일");
      const warning = stats.rangeDistribution.find((r) => r.range === "8~14일");
      const critical = stats.rangeDistribution.find((r) => r.range === "15일 이상");

      expect(minor?.count).toBe(1);
      expect(minor?.totalDays).toBe(2);
      expect(minor?.countRate).toBe(25.0);

      expect(moderate?.count).toBe(1);
      expect(moderate?.totalDays).toBe(5);

      expect(warning?.count).toBe(1);
      expect(warning?.totalDays).toBe(10);

      expect(critical?.count).toBe(1);
      expect(critical?.totalDays).toBe(18);

      // Group stats checks (sorted by totalDelayDays desc)
      expect(stats.groupStats[0].groupLabel).toBe("공통"); // 18일
      expect(stats.groupStats[1].groupLabel).toBe("결제"); // 12일 (2+10)
      expect(stats.groupStats[1].count).toBe(2);
      expect(stats.groupStats[1].totalDelayDays).toBe(12);
      expect(stats.groupStats[1].avgDelayDays).toBe(6.0);
      expect(stats.groupStats[1].maxDelayDays).toBe(10);

      // Owner stats checks
      expect(stats.ownerStats[0].ownerName).toBe("이영희"); // 18일
      expect(stats.ownerStats[1].ownerName).toBe("홍길동"); // 12일

      // Monthly trend checks (chronological order)
      expect(stats.monthlyTrend).toHaveLength(2);
      expect(stats.monthlyTrend[0].month).toBe("2026-09");
      expect(stats.monthlyTrend[0].count).toBe(2);
      expect(stats.monthlyTrend[0].totalDelayDays).toBe(28); // 10 + 18
      expect(stats.monthlyTrend[1].month).toBe("2026-10");
      expect(stats.monthlyTrend[1].count).toBe(2);
      expect(stats.monthlyTrend[1].totalDelayDays).toBe(7); // 2 + 5

      // Top delayed tasks (descending delayDays)
      expect(stats.topDelayedTasks).toHaveLength(4);
      expect(stats.topDelayedTasks[0].name).toBe("회원 인증 SSO 개편");
      expect(stats.topDelayedTasks[0].delayDays).toBe(18);
      expect(stats.topDelayedTasks[1].name).toBe("정산 인터페이스 배치");
      expect(stats.topDelayedTasks[1].delayDays).toBe(10);
    });
  });

  describe("UI Components & Sub-Tab Navigation", () => {
    it("renders WbsDelayHistoryTabs with correct active tab and query preservation", () => {
      const html = renderToStaticMarkup(
        React.createElement(WbsDelayHistoryTabs, {
          activeTab: "list",
          isMp: true,
          filters: { from: "2026-10-01", to: "2026-10-28" },
        })
      );

      expect(html).toContain('href="/mp-wbs/delay-history?from=2026-10-01&amp;to=2026-10-28"');
      expect(html).toContain('href="/mp-wbs/delay-history/stats?from=2026-10-01&amp;to=2026-10-28"');
      expect(html).toContain('class="active"');
      expect(html).toContain("지연 이력 목록");
      expect(html).toContain("지연 이력 통계");
    });

    it("renders WbsDelayHistoryTabs for single project legacy path", () => {
      const html = renderToStaticMarkup(
        React.createElement(WbsDelayHistoryTabs, {
          activeTab: "stats",
          isMp: false,
        })
      );

      expect(html).toContain('href="/wbs/delay-history"');
      expect(html).toContain('href="/wbs/delay-history/stats"');
      expect(html).toContain('class="active"');
      expect(html).toContain('aria-current="page"');
    });

    it("renders WbsDelayHistoryStatsScreen with KPI cards, tables, and top delayed tasks", () => {
      const mockStats = {
        totalCount: 2,
        totalDelayDays: 14,
        avgDelayDays: 7.0,
        maxDelayDays: 9,
        affectedOwnersCount: 2,
        affectedGroupsCount: 2,
        rangeDistribution: [
          { range: "1~3일", label: "경미 (1~3일)", count: 0, totalDays: 0, countRate: 0, badgeClass: "band-blue" },
          { range: "4~7일", label: "주의 (4~7일)", count: 1, totalDays: 5, countRate: 50.0, badgeClass: "band-yellow" },
          { range: "8~14일", label: "경고 (8~14일)", count: 1, totalDays: 9, countRate: 50.0, badgeClass: "band-orange" },
          { range: "15일 이상", label: "심각 (15일+)", count: 0, totalDays: 0, countRate: 0, badgeClass: "band-red" },
        ],
        groupStats: [
          { groupLabel: "결제", count: 1, countRate: 50.0, totalDelayDays: 9, avgDelayDays: 9.0, maxDelayDays: 9, daysRate: 64.3 },
          { groupLabel: "채널", count: 1, countRate: 50.0, totalDelayDays: 5, avgDelayDays: 5.0, maxDelayDays: 5, daysRate: 35.7 },
        ],
        ownerStats: [
          { ownerName: "홍길동", groupLabel: "결제", count: 1, totalDelayDays: 9, avgDelayDays: 9.0, maxDelayDays: 9 },
          { ownerName: "김철수", groupLabel: "채널", count: 1, totalDelayDays: 5, avgDelayDays: 5.0, maxDelayDays: 5 },
        ],
        monthlyTrend: [
          { month: "2026-10", count: 2, totalDelayDays: 14, avgDelayDays: 7.0 },
        ],
        topDelayedTasks: [
          {
            id: "task-1",
            wbsItemId: "item-1",
            code: "1.2.3",
            name: "PG사 결제 연동",
            groupLabel: "결제",
            ownerName: "홍길동",
            plannedDueDate: "2026-10-10",
            actualDueDate: "2026-10-19",
            delayDays: 9,
            createdAt: "2026-10-19T00:00:00.000Z",
          },
        ],
      };

      const html = renderToStaticMarkup(
        React.createElement(WbsDelayHistoryStatsScreen, {
          stats: mockStats,
          filters: {},
          isMp: false,
        })
      );

      expect(html).toContain("지연 이력 통계");
      expect(html).toContain("2건"); // 총 지연 건수
      expect(html).toContain("14일"); // 누적 지연일수
      expect(html).toContain("7.0일"); // 평균 지연일수
      expect(html).toContain("9일"); // 최대 지연일수
      expect(html).toContain("PG사 결제 연동");
      expect(html).toContain('href="/wbs/item-1"');
      expect(html).toContain("지연 일수 구간 분포");
      expect(html).toContain("업무그룹별 지연 현황");
      expect(html).toContain("담당자별 지연 현황");
      expect(html).toContain("월별 지연 등록 추이");
      expect(html).toContain("최대 지연 Task (상위 5건)");
    });

    it("renders MpWbsDelayHistoryStatsScreen with multi-project WBS link prefix", () => {
      const mockStats = {
        totalCount: 1,
        totalDelayDays: 5,
        avgDelayDays: 5.0,
        maxDelayDays: 5,
        affectedOwnersCount: 1,
        affectedGroupsCount: 1,
        rangeDistribution: [
          { range: "1~3일", label: "경미 (1~3일)", count: 0, totalDays: 0, countRate: 0, badgeClass: "band-blue" },
          { range: "4~7일", label: "주의 (4~7일)", count: 1, totalDays: 5, countRate: 100.0, badgeClass: "band-yellow" },
          { range: "8~14일", label: "경고 (8~14일)", count: 0, totalDays: 0, countRate: 0, badgeClass: "band-orange" },
          { range: "15일 이상", label: "심각 (15일+)", count: 0, totalDays: 0, countRate: 0, badgeClass: "band-red" },
        ],
        groupStats: [{ groupLabel: "BO", count: 1, countRate: 100.0, totalDelayDays: 5, avgDelayDays: 5.0, maxDelayDays: 5, daysRate: 100.0 }],
        ownerStats: [{ ownerName: "이몽룡", groupLabel: "BO", count: 1, totalDelayDays: 5, avgDelayDays: 5.0, maxDelayDays: 5 }],
        monthlyTrend: [{ month: "2026-10", count: 1, totalDelayDays: 5, avgDelayDays: 5.0 }],
        topDelayedTasks: [
          {
            id: "task-mp-1",
            wbsItemId: "item-mp-1",
            code: "2.1",
            name: "상품 마스터 마이그레이션",
            groupLabel: "BO",
            ownerName: "이몽룡",
            plannedDueDate: "2026-10-15",
            actualDueDate: "2026-10-20",
            delayDays: 5,
            createdAt: "2026-10-20T00:00:00.000Z",
          },
        ],
      };

      const html = renderToStaticMarkup(
        React.createElement(MpWbsDelayHistoryStatsScreen, {
          stats: mockStats,
          filters: {},
          isMp: true,
        })
      );

      expect(html).toContain('href="/mp-wbs/item-mp-1"');
      expect(html).toContain('href="/mp-wbs/delay-history"');
      expect(html).toContain('href="/mp-wbs/delay-history/stats"');
    });
  });
});
