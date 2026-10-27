import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { PmoDailyScreen } from "./PmoDailyScreen";
import { PmoDailyDashboardScreen } from "./PmoDailyDashboardScreen";
import type { PmoDailyDashboard, PmoDailyHomeDashboard } from "@/lib/server/pmo-daily";
import type { OverdueMeetingActionItems } from "@/lib/server/meeting-action-items";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("PMO Daily WBS Links Verification", () => {
  it("PmoDailyScreen renders delayed tasks pointing to /mp-wbs/${task.id}", () => {
    const mockData: PmoDailyDashboard = {
      reportDate: "2026-10-27",
      exists: true,
      snapshot: {
        plannedTaskCount: 10,
        actualTaskCount: 8,
        totalTaskCount: 50,
        completedTaskCount: 20,
        version: 1,
      },
      metrics: {
        scheduleProgress: 80,
        delayedTaskCount: 2,
        delayedRate: 20,
        overallProgress: 40,
      },
      delayedTasks: [
        {
          id: "569c73fc-54b2-4bc6-b89f-b32c0fac1e4a",
          code: "3.1.22.17",
          name: "테스트 Task",
          stage: "개발",
          ownerName: "홍길동",
          groupLabel: "개발1팀",
          startDate: "2026-10-01",
          dueDate: "2026-10-27",
          actualStartDate: "2026-10-05",
          actualDueDate: null,
          delayDays: 3,
          delayRate: 0.1,
        },
      ],
      delayedTaskTotal: 1,
      issues: [],
      managementTasks: [],
    };

    const html = renderToString(React.createElement(PmoDailyScreen, { data: mockData, mode: "edit" }));

    // Must link to /mp-wbs/569c73fc-54b2-4bc6-b89f-b32c0fac1e4a
    expect(html).toContain('href="/mp-wbs/569c73fc-54b2-4bc6-b89f-b32c0fac1e4a"');
    // Must NOT link to legacy /wbs/
    expect(html).not.toContain('href="/wbs/569c73fc-54b2-4bc6-b89f-b32c0fac1e4a"');
  });

  it("PmoDailyDashboardScreen renders KPI cards and task lists pointing to /mp-wbs/*", () => {
    const mockHomeData: PmoDailyHomeDashboard = {
      today: "2026-10-27",
      taskSummary: {
        inProgress: 15,
        doneToday: 4,
        delayed: 2,
      },
      days: [
        {
          key: "today",
          label: "오늘",
          date: "2026-10-27",
          starting: [
            {
              id: "task-start-1",
              code: "1.1.1",
              name: "시작 Task",
              ownerName: "김철수",
              startDate: "2026-10-27",
              dueDate: "2026-11-01",
              state: "in_progress",
              delayDays: null,
            },
          ],
          ending: [
            {
              id: "task-end-1",
              code: "1.1.2",
              name: "종료 Task",
              ownerName: "이영희",
              startDate: "2026-10-20",
              dueDate: "2026-10-27",
              state: "done",
              delayDays: null,
            },
          ],
        },
      ],
      meetingDays: [],
      delayedGroups: [
        {
          groupLabel: "개발1팀",
          tasks: [
            {
              id: "569c73fc-54b2-4bc6-b89f-b32c0fac1e4a",
              code: "3.1.22.17",
              name: "지연 Task",
              ownerName: "박영수",
              startDate: "2026-10-01",
              dueDate: "2026-10-25",
              state: "delayed",
              delayDays: 2,
            },
          ],
        },
      ],
      issues: [],
    };

    const mockOverdueActions: OverdueMeetingActionItems = {
      total: 0,
      rows: [],
    };

    const html = renderToString(React.createElement(PmoDailyDashboardScreen, { data: mockHomeData, overdueActions: mockOverdueActions }));

    // Check KPI links
    expect(html).toContain('href="/mp-wbs?status=in_progress"');
    expect(html).toContain('href="/mp-wbs?actualDueDateFrom=2026-10-27&amp;actualDueDateTo=2026-10-27"');
    expect(html).toContain('href="/mp-wbs?delayed=y"');

    // Check Task detail links
    expect(html).toContain('href="/mp-wbs/task-start-1"');
    expect(html).toContain('href="/mp-wbs/task-end-1"');
    expect(html).toContain('href="/mp-wbs/569c73fc-54b2-4bc6-b89f-b32c0fac1e4a"');

    // Ensure zero legacy /wbs/ links
    expect(html).not.toMatch(/href="\/wbs[\/?]/);
  });
});
