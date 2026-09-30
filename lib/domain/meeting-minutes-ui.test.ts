import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MeetingMinuteDocument } from "@/features/meeting-minutes/MeetingMinuteDocument";
import { MeetingMinuteListScreen } from "@/screens/MeetingMinuteListScreen";
import type { MeetingMinuteDetail } from "@/lib/server/meeting-minutes";

// 목록 행 클릭 컴포넌트(ClickableTableRow)는 앱 라우터를 요구하므로 정적 렌더링 테스트에서는 라우터만 대체한다.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

const minute: MeetingMinuteDetail = {
  id: "m1", displayId: "MM-0001", category: "DES", title: "상품전시 내부리뷰", meetingDate: "2026-09-28",
  sessions: [{ start: "09:30", end: "12:00" }, { start: "13:30", end: "15:00" }], location: "퍼시픽타워 22층 대회의실", authorName: "이승연",
  attendees: [{ side: "VENDOR", userId: null, name: "신세계 I&C" }, { side: "VENDOR", userId: null, name: "BO 기획" }, { side: "CUSTOMER", userId: null, name: "이마트 상품팀" }],
  contents: [{ content: "상품 상세 검토", remark: "옵션 노출 이슈", plannedSchedule: "" }], decisions: [], notes: [],
  actionItems: [{ title: "옵션 UI 수정안", content: "시안 2종", assigneeId: null, assigneeName: "홍길동", dueDate: "2026-10-02" }],
  createdBy: "u1", creatorName: "등록자", createdAt: "2026-09-28T00:00:00.000Z", updatedAt: "2026-09-28T00:00:00.000Z", version: 1, canEdit: true,
  signature: { pmName: "정재균", customerName: "이마트" },
};
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("회의록 양식 렌더링", () => {
  it("reproduces the template header, info and sections", () => {
    const html = text(renderToStaticMarkup(React.createElement(MeetingMinuteDocument, { minute })));
    expect(html).toContain("회의록 서명 PM 발주사 이마트 온오프 통합커머스 플랫폼 구축 정재균 이마트");
    expect(html).toContain("2026.09.28 09:30~12:00, 13:30~15:00");
    expect(html).toContain("발주사 이마트 상품팀");
    expect(html).toContain("수행사 신세계 I&amp;C, BO 기획");
    expect(html).toContain("옵션 UI 수정안 시안 2종 홍길동 2026.10.02");
    for (const label of ["회의 내용", "결정사항", "Action Item", "특이 사항"]) expect(html).toContain(label);
  });

  it("keeps blank rows like the paper template so empty sections still print", () => {
    const html = renderToStaticMarkup(React.createElement(MeetingMinuteDocument, { minute: { ...minute, contents: [], decisions: [], notes: [], actionItems: [] } }));
    // 헤더 2 + 기본정보 6 + 회의내용(1+4) + 결정사항(1+2) + Action Item(1+3) + 특이사항(1+2)
    expect(html.match(/<tr/g)?.length).toBe(2 + 6 + 5 + 3 + 4 + 3);
  });

  it("renders the list with sessions and the create action", () => {
    const html = renderToStaticMarkup(React.createElement(MeetingMinuteListScreen, {
      result: { rows: [{ id: "m1", displayId: "MM-0001", category: "DES", title: "상품전시 내부리뷰", meetingDate: "2026-09-28", sessions: minute.sessions, location: "대회의실", authorName: "이승연", actionItemCount: 1, updatedAt: "" }], total: 1, page: 1, pageSize: 20, totalPages: 1 },
      filters: { q: "", dateFrom: "", dateTo: "" },
    }));
    expect(html).toContain("09:30~12:00, 13:30~15:00");
    expect(html).toContain("+ 회의록 작성");
    expect(html).toContain('href="/meeting-minutes/m1"');
  });
});
