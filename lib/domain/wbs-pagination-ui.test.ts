import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WbsListScreen } from "@/screens/WbsListScreen";
import type { WbsExcelListResult } from "@/lib/server/wbs";

describe("WbsListScreen Pagination UI", () => {
  const mockResult: WbsExcelListResult = {
    rows: [],
    total: 100,
    page: 1,
    pageSize: 50,
    totalPages: 2,
    stages: ["착수", "분석", "기획", "설계", "개발"],
  };

  const defaultFilters = {
    page: 1,
    pageSize: 50 as const,
    q: "",
    assignee: "",
    startDateFrom: "",
    startDateTo: "",
    dueDateFrom: "",
    dueDateTo: "",
    actualStartDateFrom: "",
    actualStartDateTo: "",
    actualDueDateFrom: "",
    actualDueDateTo: "",
    delayed: "" as const,
    stage: "",
    status: "" as const,
    excludeCompleted: true,
  };

  it("renders pageSize select dropdown with exactly 50, 100, 200 options", () => {
    const html = renderToStaticMarkup(
      React.createElement(WbsListScreen, {
        result: mockResult,
        filters: defaultFilters,
      })
    );

    // select 엘리먼트 추출
    const selectMatch = html.match(/<select name="pageSize"[\s\S]*?<\/select>/);
    expect(selectMatch).not.toBeNull();
    const selectHtml = selectMatch![0];

    // 옵션 검증 (기본값 50에 selected 속성 확인)
    expect(selectHtml).toContain('<option value="50" selected="">50개</option>');
    expect(selectHtml).toContain('<option value="100">100개</option>');
    expect(selectHtml).toContain('<option value="200">200개</option>');

    // 기존 10, 20, 40, 60, 80, all 배제 확인
    expect(selectHtml).not.toContain('<option value="10">');
    expect(selectHtml).not.toContain('<option value="20">');
    expect(selectHtml).not.toContain('<option value="40">');
    expect(selectHtml).not.toContain('<option value="60">');
    expect(selectHtml).not.toContain('<option value="80">');
    expect(selectHtml).not.toContain('<option value="all">');
  });

  it("does not render hidden pageSize input in search form when pageSize is default (50)", () => {
    const html = renderToStaticMarkup(
      React.createElement(WbsListScreen, {
        result: mockResult,
        filters: defaultFilters,
      })
    );

    // 기본값 50일 때는 hidden input이 생기지 않아야 함
    expect(html).not.toContain('<input type="hidden" name="pageSize" value="50"/>');
  });

  it("renders hidden pageSize input in search form when pageSize is non-default (100)", () => {
    const html = renderToStaticMarkup(
      React.createElement(WbsListScreen, {
        result: { ...mockResult, pageSize: 100 },
        filters: { ...defaultFilters, pageSize: 100 },
      })
    );

    expect(html).toContain('<input type="hidden" name="pageSize" value="100"/>');
  });

  it("renders stage select dropdown with project stages list", () => {
    const html = renderToStaticMarkup(
      React.createElement(WbsListScreen, {
        result: mockResult,
        filters: { ...defaultFilters, stage: "기획" },
      })
    );

    const stageMatch = html.match(/<select name="stage"[\s\S]*?<\/select>/);
    expect(stageMatch).not.toBeNull();
    const stageHtml = stageMatch![0];

    // 전체 Stage 기본 옵션 확인
    expect(stageHtml).toContain('<option value="">전체 Stage</option>');

    // 각 Stage 옵션 렌더링 확인
    expect(stageHtml).toContain('<option value="착수">착수</option>');
    expect(stageHtml).toContain('<option value="분석">분석</option>');
    expect(stageHtml).toContain('<option value="기획" selected="">기획</option>');
    expect(stageHtml).toContain('<option value="설계">설계</option>');
    expect(stageHtml).toContain('<option value="개발">개발</option>');

    // 기존 input[name="stage"]가 없는지 확인
    expect(html).not.toContain('<input name="stage"');
  });

  it("does not render '+ 신규 등록' button in WbsListScreen", () => {
    const html = renderToStaticMarkup(
      React.createElement(WbsListScreen, {
        result: mockResult,
        filters: defaultFilters,
      })
    );

    // + 신규 등록 버튼이 없어야 함
    expect(html).not.toContain("+ 신규 등록");
    expect(html).not.toContain('href="/wbs/new"');
  });

  it("ensures WBS new item registration is restricted to isManager (SUPER_ADMIN, ADMIN, OPERATOR)", () => {
    const fs = require("fs");
    const path = require("path");

    const navSource = fs.readFileSync(path.resolve(__dirname, "../../components/AppNavigation.tsx"), "utf8");
    // WBS 항목 등록이 무조건 노출되지 않고 isManager 조건부 배열 내부에 포함되어 있는지 검증
    expect(navSource).not.toMatch(/"\/wbs":\s*\[[^\]]*\{href:"\/wbs\/new",label:"WBS 항목 등록"\}[^\]]*,\.\.\.\(isManager/);
    expect(navSource).toMatch(/\.\.\.\(isManager\?\[\{href:"\/wbs\/new",label:"WBS 항목 등록"\}/);

    const newPageSource = fs.readFileSync(path.resolve(__dirname, "../../app/wbs/new/page.tsx"), "utf8");
    // URL 직접 접근 방어를 위해 requireManagerContext() 호출 확인
    expect(newPageSource).toContain("requireManagerContext");
    expect(newPageSource).not.toContain("getLocalContext");
  });
});
