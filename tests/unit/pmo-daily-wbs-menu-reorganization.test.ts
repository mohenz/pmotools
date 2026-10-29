import { describe, it, expect } from "vitest";

describe("PMO Daily - WBS 메뉴 재구조화 (IA Reorganization) 단위 테스트", () => {
  const isPmoDailyWbsSubPath = (path: string) => {
    return (
      path.startsWith("/mp-wbs/new") || path.startsWith("/wbs/new") ||
      path.startsWith("/mp-wbs/gantt") || path.startsWith("/wbs/gantt") ||
      path.startsWith("/mp-wbs/delay-history") || path.startsWith("/wbs/delay-history") ||
      path.startsWith("/mp-wbs/weekly-stats") || path.startsWith("/wbs/weekly-stats") ||
      path.startsWith("/mp-wbs/group-stats") || path.startsWith("/wbs/group-stats") ||
      path.startsWith("/mp-wbs/group-tasks") || path.startsWith("/wbs/group-tasks") ||
      path.startsWith("/mp-wbs/manage") || path.startsWith("/wbs/manage") ||
      path.startsWith("/mp-wbs/owner-conflicts") || path.startsWith("/wbs/owner-conflicts")
    );
  };

  const getToolActive = (pathname: string, key: string, href: string) => {
    if (key === "pmo-daily") return pathname.startsWith("/pmo-daily") || isPmoDailyWbsSubPath(pathname);
    if (key === "wbs" || key === "wbs2") {
      if (isPmoDailyWbsSubPath(pathname)) return false;
      return pathname.startsWith(href);
    }
    if (key === "issues") return pathname.startsWith("/issues");
    if (key === "test") return pathname.startsWith("/mp-ut") || pathname.startsWith("/mp-defects");
    if (key === "management-tasks") return pathname.startsWith("/management-tasks") || pathname.startsWith("/action-items");
    return pathname.startsWith(href);
  };

  const checkTabActive = (pathname: string, tabHref: string, currentToolHref: string) => {
    const normPath = pathname.replace(/^\/wbs(?=\/|$)/, "/mp-wbs");
    const normTab = tabHref.replace(/^\/wbs(?=\/|$)/, "/mp-wbs");
    const isSubRoute = (normTab.includes("/group-stats") && normPath.includes("/group-tasks")) ||
                       (normTab.includes("/manage") && normPath.includes("/owner-conflicts"));
    return pathname === tabHref || normPath === normTab || (tabHref !== currentToolHref && normPath.startsWith(`${normTab}/`)) || isSubRoute;
  };

  describe("1. isPmoDailyWbsSubPath 판정 테스트", () => {
    it("이동 대상 WBS 관리 메뉴(WBS 항목 등록 포함) 경로는 모두 PMO Daily 하위 경로로 판정되어야 한다", () => {
      const movedPaths = [
        "/mp-wbs/new",
        "/wbs/new",
        "/mp-wbs/gantt",
        "/wbs/gantt",
        "/mp-wbs/delay-history",
        "/wbs/delay-history",
        "/mp-wbs/delay-history/stats",
        "/wbs/delay-history/stats",
        "/mp-wbs/weekly-stats",
        "/wbs/weekly-stats",
        "/mp-wbs/group-stats",
        "/wbs/group-stats",
        "/mp-wbs/group-tasks",
        "/wbs/group-tasks",
        "/mp-wbs/manage",
        "/wbs/manage",
        "/mp-wbs/owner-conflicts",
        "/wbs/owner-conflicts",
      ];

      for (const path of movedPaths) {
        expect(isPmoDailyWbsSubPath(path), `Path ${path} should be PMO Daily sub path`).toBe(true);
      }
    });

    it("WBS 본체 고유 경로는 PMO Daily 하위 경로로 판정되지 않아야 한다", () => {
      const wbsCorePaths = [
        "/mp-wbs",
        "/wbs",
        "/mp-wbs/stats",
        "/wbs/stats",
        "/mp-wbs/123",
        "/wbs/123",
        "/manuals/wbs",
      ];

      for (const path of wbsCorePaths) {
        expect(isPmoDailyWbsSubPath(path), `Path ${path} should NOT be PMO Daily sub path`).toBe(false);
      }
    });
  });

  describe("2. 도구 활성화(toolActive) 거버넌스 테스트", () => {
    it("WBS 항목 등록(/new) 접속 시 PMO Daily가 활성화되고 WBS는 비활성화되어야 한다", () => {
      expect(getToolActive("/mp-wbs/new", "pmo-daily", "/pmo-daily")).toBe(true);
      expect(getToolActive("/mp-wbs/new", "wbs2", "/mp-wbs")).toBe(false);
      expect(getToolActive("/wbs/new", "pmo-daily", "/pmo-daily")).toBe(true);
      expect(getToolActive("/wbs/new", "wbs", "/wbs")).toBe(false);
    });

    it("간트차트 접속 시 PMO Daily가 활성화되고 WBS는 비활성화되어야 한다", () => {
      const path = "/mp-wbs/gantt";
      expect(getToolActive(path, "pmo-daily", "/pmo-daily")).toBe(true);
      expect(getToolActive(path, "wbs2", "/mp-wbs")).toBe(false);
      expect(getToolActive(path, "wbs", "/wbs")).toBe(false);
    });

    it("지연이력 접속 시 PMO Daily가 활성화되고 WBS는 비활성화되어야 한다", () => {
      const path = "/mp-wbs/delay-history";
      expect(getToolActive(path, "pmo-daily", "/pmo-daily")).toBe(true);
      expect(getToolActive(path, "wbs2", "/mp-wbs")).toBe(false);
    });

    it("지연이력 통계(/stats) 접속 시 PMO Daily가 활성화되어야 한다", () => {
      const path = "/mp-wbs/delay-history/stats";
      expect(getToolActive(path, "pmo-daily", "/pmo-daily")).toBe(true);
      expect(getToolActive(path, "wbs2", "/mp-wbs")).toBe(false);
    });

    it("주간통계 접속 시 PMO Daily가 활성화되어야 한다", () => {
      const path = "/mp-wbs/weekly-stats";
      expect(getToolActive(path, "pmo-daily", "/pmo-daily")).toBe(true);
      expect(getToolActive(path, "wbs2", "/mp-wbs")).toBe(false);
    });

    it("업무그룹별통계 접속 시 PMO Daily가 활성화되어야 한다", () => {
      const path = "/mp-wbs/group-stats";
      expect(getToolActive(path, "pmo-daily", "/pmo-daily")).toBe(true);
      expect(getToolActive(path, "wbs2", "/mp-wbs")).toBe(false);
    });

    it("데이터 관리 접속 시 PMO Daily가 활성화되어야 한다", () => {
      const path = "/mp-wbs/manage";
      expect(getToolActive(path, "pmo-daily", "/pmo-daily")).toBe(true);
      expect(getToolActive(path, "wbs2", "/mp-wbs")).toBe(false);
    });

    it("WBS 전체 목록(/mp-wbs) 접속 시 WBS가 정상 활성화되고 PMO Daily는 비활성화되어야 한다", () => {
      const path = "/mp-wbs";
      expect(getToolActive(path, "wbs2", "/mp-wbs")).toBe(true);
      expect(getToolActive(path, "pmo-daily", "/pmo-daily")).toBe(false);
    });
  });

  describe("3. 탭 active 하이라이트 매칭 테스트", () => {
    const currentToolHref = "/pmo-daily";

    it("WBS 항목 등록 탭은 /mp-wbs/new 및 /wbs/new에서 active여야 한다", () => {
      const tabHref = "/mp-wbs/new";
      expect(checkTabActive("/mp-wbs/new", tabHref, currentToolHref)).toBe(true);
      expect(checkTabActive("/wbs/new", tabHref, currentToolHref)).toBe(true);
      expect(checkTabActive("/mp-wbs/gantt", tabHref, currentToolHref)).toBe(false);
    });

    it("간트차트 탭은 /mp-wbs/gantt 및 /wbs/gantt에서 active여야 한다", () => {
      const tabHref = "/mp-wbs/gantt";
      expect(checkTabActive("/mp-wbs/gantt", tabHref, currentToolHref)).toBe(true);
      expect(checkTabActive("/wbs/gantt", tabHref, currentToolHref)).toBe(true);
      expect(checkTabActive("/mp-wbs/delay-history", tabHref, currentToolHref)).toBe(false);
    });

    it("지연이력 탭은 /mp-wbs/delay-history 및 /stats 서브경로에서도 active여야 한다", () => {
      const tabHref = "/mp-wbs/delay-history";
      expect(checkTabActive("/mp-wbs/delay-history", tabHref, currentToolHref)).toBe(true);
      expect(checkTabActive("/mp-wbs/delay-history/stats", tabHref, currentToolHref)).toBe(true);
      expect(checkTabActive("/wbs/delay-history/stats", tabHref, currentToolHref)).toBe(true);
    });

    it("업무그룹별 통계 탭은 /mp-wbs/group-tasks 서브페이지에서도 active여야 한다", () => {
      const tabHref = "/mp-wbs/group-stats";
      expect(checkTabActive("/mp-wbs/group-stats", tabHref, currentToolHref)).toBe(true);
      expect(checkTabActive("/mp-wbs/group-tasks", tabHref, currentToolHref)).toBe(true);
    });

    it("데이터 관리 탭은 /mp-wbs/owner-conflicts 서브페이지에서도 active여야 한다", () => {
      const tabHref = "/mp-wbs/manage";
      expect(checkTabActive("/mp-wbs/manage", tabHref, currentToolHref)).toBe(true);
      expect(checkTabActive("/mp-wbs/owner-conflicts", tabHref, currentToolHref)).toBe(true);
    });

    it("대시보드 탭은 /pmo-daily/dashboard에서 active여야 한다", () => {
      const tabHref = "/pmo-daily/dashboard";
      expect(checkTabActive("/pmo-daily/dashboard", tabHref, currentToolHref)).toBe(true);
      expect(checkTabActive("/mp-wbs/gantt", tabHref, currentToolHref)).toBe(false);
    });
  });

  describe("4. PMO Daily 하위 탭 순서 및 명칭 거버넌스 테스트 (2026-10-29)", () => {
    const getPmoDailyTabs = (isManager: boolean, wbsBase = "/mp-wbs") => [
      { href: "/pmo-daily/dashboard", label: "대시보드" },
      { href: "/pmo-daily/portfolio", label: "프로젝트현황" },
      { href: "/pmo-daily", label: "일자별 목록" },
      { href: "/pmo-daily/new", label: "신규 작성" },
      ...(isManager ? [
        { href: `${wbsBase}/group-stats`, label: "업무그룹별 통계" },
        { href: `${wbsBase}/weekly-stats`, label: "주간 통계" },
      ] : []),
      { href: `${wbsBase}/gantt`, label: "간트 차트" },
      ...(isManager ? [
        { href: `${wbsBase}/delay-history`, label: "지연 이력" },
        { href: `${wbsBase}/manage`, label: "데이터 관리" },
        { href: `${wbsBase}/new`, label: "WBS 항목 등록" },
      ] : []),
    ];

    it("관리자(isManager=true) 기준 정확히 10개의 메뉴가 지정된 순서와 명칭대로 배치되어야 한다", () => {
      const tabs = getPmoDailyTabs(true, "/mp-wbs");
      expect(tabs.length).toBe(10);
      expect(tabs.map(t => t.label)).toEqual([
        "대시보드",
        "프로젝트현황",
        "일자별 목록",
        "신규 작성",
        "업무그룹별 통계",
        "주간 통계",
        "간트 차트",
        "지연 이력",
        "데이터 관리",
        "WBS 항목 등록",
      ]);
    });

    it("일정관리 메뉴는 완전히 제거되어야 한다", () => {
      const tabs = getPmoDailyTabs(true);
      expect(tabs.some(t => t.label === "일정관리")).toBe(false);
      expect(tabs.some(t => t.href === "/calendar")).toBe(false);
    });

    it("기존 '프로젝트 포트폴리오'는 '프로젝트현황'으로 명칭이 변경되어야 한다", () => {
      const tabs = getPmoDailyTabs(true);
      expect(tabs.some(t => t.label === "프로젝트 포트폴리오")).toBe(false);
      const portfolioTab = tabs.find(t => t.href === "/pmo-daily/portfolio");
      expect(portfolioTab).toBeDefined();
      expect(portfolioTab?.label).toBe("프로젝트현황");
    });
  });
});
