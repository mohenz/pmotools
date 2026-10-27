import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { PortfolioScreen } from "./PortfolioScreen";
import type { WbsStats, WbsOwnerStatus } from "@/lib/server/wbs";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("PortfolioScreen WBS Links Standard (/mp-wbs/*) Verification", () => {
  const mockWbsStats: WbsStats = {
    overall: { planned: 0.85, actual: 0.72, progressIndex: 0.85 },
    itemCount: 100,
    plannedCount: 80,
    actualCount: 65,
    scheduleProgress: 81,
    delayedCount: 3,
    delayTrackedCount: 75,
    delayRate: 0.04,
    stages: [
      {
        stage: "개발",
        itemCount: 50,
        planned: 0.8,
        actual: 0.7,
        plannedCount: 40,
        actualCount: 35,
        scheduleProgress: 88,
        delayedCount: 1,
        delayTrackedCount: 38,
        delayRate: 0.026,
        delayed: true,
      },
    ],
  };

  const mockMyWbsStatus = {
    owner: { userId: "user-1", name: "홍길동", loginId: "hong1" },
    overall: { planned: 0.9, actual: 0.8, progressIndex: 0.89 },
    items: [
      {
        id: "wbs-item-123",
        code: "3.1.22.17",
        name: "단위테스트 작성 및 수행",
        stage: "개발",
        startDate: "2026-10-01",
        dueDate: "2026-10-27",
        actualStartDate: "2026-10-02",
        actualDueDate: null,
        plannedProgress: 1.0,
        actualProgress: 0.8,
        progressIndex: 0.8,
        weight: 10,
        workingDays: 20,
        status: "in_progress",
      },
    ],
  } as unknown as WbsOwnerStatus;

  const mockPanelPrefs = [
    { id: "p-1", projectId: "proj-1", key: "wbs-progress", visible: true, label: "WBS 진척", sortOrder: 1 },
    { id: "p-2", projectId: "proj-1", key: "my-wbs-status", visible: true, label: "나의 WBS 현황", sortOrder: 2 },
    { id: "p-3", projectId: "proj-1", key: "my-wbs-tasks", visible: true, label: "나의 WBS Task", sortOrder: 3 },
    { id: "p-4", projectId: "proj-1", key: "invitations", visible: false, label: "초청", sortOrder: 4 },
  ];

  it("renders PortfolioScreen with all WBS links pointing to /mp-wbs/* and zero /wbs/ links", () => {
    const html = renderToString(
      React.createElement(PortfolioScreen, {
        wbsStats: mockWbsStats,
        myWbsStatus: mockMyWbsStatus,
        panelPrefs: mockPanelPrefs,
        invitations: [],
        role: "ADMIN",
      })
    );

    // 1. WBS 진척 패널 링크
    expect(html).toContain('href="/mp-wbs/stats"');
    // 2. 나의 WBS 현황 패널 링크
    expect(html).toContain('href="/mp-wbs/by-owner/hong1"');
    // 3. 나의 WBS Task 테이블 행 및 타이틀 링크
    expect(html).toContain('href="/mp-wbs/wbs-item-123"');
    // 4. 담당 Task 전체 보기 버튼 링크
    expect(html).toContain('href="/mp-wbs/by-owner/hong1"');

    // 5. 레거시 /wbs/ 또는 /wbs 링크가 일체 없어야 함
    expect(html).not.toMatch(/href="\/wbs[\/?"]/);
  });
});
