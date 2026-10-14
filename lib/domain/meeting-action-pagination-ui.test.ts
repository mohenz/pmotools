import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MeetingActionItemListScreen, type MeetingActionItemScreenFilters } from "@/screens/MeetingActionItemListScreen";
import type { MeetingActionItemListResult } from "@/lib/server/meeting-action-items";

describe("MeetingActionItemListScreen Pagination UI", () => {
  const mockResult: MeetingActionItemListResult = {
    rows: [],
    summary: { total: 45, overdue: 3, WAITING: 10, IN_PROGRESS: 20, ON_HOLD: 5, DONE: 10 },
    total: 45,
    page: 2,
    pageSize: 20,
    totalPages: 3,
  };

  const defaultFilters: MeetingActionItemScreenFilters = {
    status: "open",
    overdue: false,
    mine: true,
    assignee: "홍길동",
    q: "로그인",
    dateFrom: "2026-10-01",
    dateTo: "2026-10-31",
    page: 2,
    pageSize: 20,
  };

  it("renders standard requirement-pagination nav with page-size-form when total > 0", () => {
    const html = renderToStaticMarkup(
      React.createElement(MeetingActionItemListScreen, {
        result: mockResult,
        filters: defaultFilters,
        today: "2026-10-12",
      })
    );

    expect(html).toContain('class="pagination requirement-pagination"');
    expect(html).toContain('class="page-size-form"');
    expect(html).toContain('class="page-links"');
    expect(html).toContain('class="page-summary"');
  });

  it("renders pageSize select dropdown with exactly 20, 40, 60, 80, 100, all options", () => {
    const html = renderToStaticMarkup(
      React.createElement(MeetingActionItemListScreen, {
        result: mockResult,
        filters: defaultFilters,
        today: "2026-10-12",
      })
    );

    const selectMatch = html.match(/<select name="pageSize"[\s\S]*?<\/select>/);
    expect(selectMatch).not.toBeNull();
    const selectHtml = selectMatch![0];

    expect(selectHtml).toContain('<option value="20" selected="">20개</option>');
    expect(selectHtml).toContain('<option value="40">40개</option>');
    expect(selectHtml).toContain('<option value="60">60개</option>');
    expect(selectHtml).toContain('<option value="80">80개</option>');
    expect(selectHtml).toContain('<option value="100">100개</option>');
    expect(selectHtml).toContain('<option value="all">전체</option>');
  });

  it("preserves active filter values as hidden inputs inside page-size-form", () => {
    const html = renderToStaticMarkup(
      React.createElement(MeetingActionItemListScreen, {
        result: mockResult,
        filters: defaultFilters,
        today: "2026-10-12",
      })
    );

    expect(html).toContain('<input type="hidden" name="status" value="open"/>');
    expect(html).toContain('<input type="hidden" name="assignee" value="홍길동"/>');
    expect(html).toContain('<input type="hidden" name="q" value="로그인"/>');
    expect(html).toContain('<input type="hidden" name="mine" value="y"/>');
    expect(html).toContain('<input type="hidden" name="dateFrom" value="2026-10-01"/>');
    expect(html).toContain('<input type="hidden" name="dateTo" value="2026-10-31"/>');
  });

  it("renders previous/next links and page summary text accurately", () => {
    const html = renderToStaticMarkup(
      React.createElement(MeetingActionItemListScreen, {
        result: mockResult,
        filters: defaultFilters,
        today: "2026-10-12",
      })
    );

    // page is 2: both previous and next should exist
    expect(html).toContain('aria-label="이전 페이지"');
    expect(html).toContain('aria-label="다음 페이지"');
    expect(html).toContain('총 45건 · 2 / 3 페이지');
  });
});
