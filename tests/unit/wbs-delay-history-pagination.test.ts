import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { clampDelayHistoryPage } from "@/lib/server/wbs";
import { clampDelayHistoryPage as mpClampDelayHistoryPage } from "@/lib/server/mp/wbs";
import { WbsDelayHistoryScreen } from "@/screens/WbsDelayHistoryScreen";
import { WbsDelayHistoryScreen as MpWbsDelayHistoryScreen } from "@/screens/mp/WbsDelayHistoryScreen";

describe("WbsDelayHistoryScreen Standard Pagination", () => {
  describe("clampDelayHistoryPage", () => {
    it("handles default page size (20) and calculates page bounds", () => {
      const paging = clampDelayHistoryPage({ page: 1 }, 45);
      expect(paging.pageSize).toBe(20);
      expect(paging.totalPages).toBe(3);
      expect(paging.page).toBe(1);
      expect(paging.isAll).toBe(false);
      expect(paging.take).toBe(20);
      expect(paging.skip).toBe(0);
    });

    it("handles non-default pageSize and page offset", () => {
      const paging = clampDelayHistoryPage({ page: 2, pageSize: 40 }, 85);
      expect(paging.pageSize).toBe(40);
      expect(paging.totalPages).toBe(3);
      expect(paging.page).toBe(2);
      expect(paging.take).toBe(40);
      expect(paging.skip).toBe(40);
    });

    it("handles pageSize 'all' correctly", () => {
      const paging = clampDelayHistoryPage({ pageSize: "all" }, 150);
      expect(paging.pageSize).toBe("all");
      expect(paging.totalPages).toBe(1);
      expect(paging.page).toBe(1);
      expect(paging.isAll).toBe(true);
      expect(paging.take).toBeUndefined();
      expect(paging.skip).toBeUndefined();
    });

    it("clamps out-of-range page requests to last page", () => {
      const paging = clampDelayHistoryPage({ page: 99, pageSize: 20 }, 45);
      expect(paging.page).toBe(3);
      expect(paging.totalPages).toBe(3);
    });

    it("ensures mpClampDelayHistoryPage behaves identically", () => {
      const paging = mpClampDelayHistoryPage({ page: 2, pageSize: 60 }, 130);
      expect(paging.pageSize).toBe(60);
      expect(paging.totalPages).toBe(3);
      expect(paging.page).toBe(2);
      expect(paging.skip).toBe(60);
    });
  });

  describe("Pagination UI Rendering", () => {
    const mockResult = {
      rows: [
        {
          id: "delay-1",
          wbsItemId: "item-1",
          code: "1.1",
          name: "WBS 테스트 태스크 1",
          plannedStartDate: "2026-10-01",
          plannedDueDate: "2026-10-10",
          actualStartDate: "2026-10-01",
          actualDueDate: "2026-10-15",
          delayDays: 5,
          groupLabel: "결제",
          ownerName: "홍길동",
          createdAt: "2026-10-15T09:00:00.000Z",
        },
      ],
      total: 45,
      page: 2,
      pageSize: 20 as const,
      totalPages: 3,
    };

    const defaultFilters = {
      from: "2026-10-01",
      to: "2026-10-31",
      page: 2,
      pageSize: 20 as const,
    };

    it("renders standard requirement-pagination nav with page-size-form when total > 0", () => {
      const html = renderToStaticMarkup(
        React.createElement(WbsDelayHistoryScreen, {
          result: mockResult,
          filters: defaultFilters,
        })
      );

      expect(html).toContain('class="pagination requirement-pagination"');
      expect(html).toContain('class="page-size-form"');
      expect(html).toContain('class="page-links"');
      expect(html).toContain('class="page-summary"');
      expect(html).toContain("총 45건 · 2 / 3 페이지");
    });

    it("renders pageSize select dropdown with 20, 40, 60, 80, 100, all options", () => {
      const html = renderToStaticMarkup(
        React.createElement(WbsDelayHistoryScreen, {
          result: { ...mockResult, pageSize: 40 },
          filters: { ...defaultFilters, pageSize: 40 },
        })
      );

      const selectMatch = html.match(/<select name="pageSize"[\s\S]*?<\/select>/);
      expect(selectMatch).not.toBeNull();
      const selectHtml = selectMatch![0];

      expect(selectHtml).toContain('<option value="20">20개</option>');
      expect(selectHtml).toContain('<option value="40" selected="">40개</option>');
      expect(selectHtml).toContain('<option value="60">60개</option>');
      expect(selectHtml).toContain('<option value="80">80개</option>');
      expect(selectHtml).toContain('<option value="100">100개</option>');
      expect(selectHtml).toContain('<option value="all">전체</option>');
    });

    it("preserves active filter params (from, to) as hidden inputs in page-size-form", () => {
      const html = renderToStaticMarkup(
        React.createElement(WbsDelayHistoryScreen, {
          result: mockResult,
          filters: { ...defaultFilters, from: "2026-10-05", to: "2026-10-25" },
        })
      );

      expect(html).toContain('<input type="hidden" name="from" value="2026-10-05"/>');
      expect(html).toContain('<input type="hidden" name="to" value="2026-10-25"/>');
    });

    it("preserves non-default pageSize as hidden input in search form", () => {
      const html = renderToStaticMarkup(
        React.createElement(WbsDelayHistoryScreen, {
          result: { ...mockResult, pageSize: 60 },
          filters: { ...defaultFilters, pageSize: 60 },
        })
      );

      expect(html).toContain('<input type="hidden" name="pageSize" value="60"/>');
    });

    it("renders page links with current page highlighted and previous/next navigation", () => {
      const html = renderToStaticMarkup(
        React.createElement(WbsDelayHistoryScreen, {
          result: mockResult,
          filters: defaultFilters,
        })
      );

      expect(html).toContain('aria-label="이전 페이지"');
      expect(html).toContain('href="/wbs/delay-history?from=2026-10-01&amp;to=2026-10-31"'); // page 1
      expect(html).toContain('<strong class="current" aria-current="page">2</strong>');
      expect(html).toContain('aria-label="다음 페이지"');
      expect(html).toContain('href="/wbs/delay-history?from=2026-10-01&amp;to=2026-10-31&amp;page=3"');
    });

    it("renders MpWbsDelayHistoryScreen with /mp-wbs/ prefix in links", () => {
      const html = renderToStaticMarkup(
        React.createElement(MpWbsDelayHistoryScreen, {
          result: mockResult,
          filters: defaultFilters,
        })
      );

      expect(html).toContain('class="pagination requirement-pagination"');
      expect(html).toContain('href="/mp-wbs/delay-history?from=2026-10-01&amp;to=2026-10-31&amp;page=3"');
      expect(html).toContain('href="/mp-wbs/item-1"');
    });

    it("does not render pagination when total is 0", () => {
      const html = renderToStaticMarkup(
        React.createElement(WbsDelayHistoryScreen, {
          result: { rows: [], total: 0, page: 1, pageSize: 20, totalPages: 1 },
          filters: { page: 1, pageSize: 20 },
        })
      );

      expect(html).not.toContain('class="pagination requirement-pagination"');
      expect(html).toContain("조회된 지연 이력이 없습니다.");
    });
  });
});
