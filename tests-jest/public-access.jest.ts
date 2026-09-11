import { isPublicReadApi, isPublicViewPath } from "../lib/domain/public-access";

describe("비로그인 공개 조회 경계", () => {
  test.each(["/calendar", "/meetrooms"])("%s 화면은 공개한다", (pathname) => {
    expect(isPublicViewPath(pathname)).toBe(true);
  });

  test.each(["/calendar/search", "/calendar/milestones", "/meetrooms/settings"])("%s 하위 관리 화면은 공개하지 않는다", (pathname) => {
    expect(isPublicViewPath(pathname)).toBe(false);
  });

  test("회의실 예약현황 GET만 공개한다", () => {
    expect(isPublicReadApi("GET", "/api/v1/meeting-reservations")).toBe(true);
    expect(isPublicReadApi("POST", "/api/v1/meeting-reservations")).toBe(false);
    expect(isPublicReadApi("PATCH", "/api/v1/meeting-reservations")).toBe(false);
    expect(isPublicReadApi("DELETE", "/api/v1/meeting-reservations")).toBe(false);
  });

  test("회의실 예약 변경 API는 GET이어도 공개하지 않는다", () => {
    expect(isPublicReadApi("GET", "/api/v1/meeting-reservations/reservation-id")).toBe(false);
    expect(isPublicReadApi("GET", "/api/v1/recurring-meetings")).toBe(false);
  });
});
