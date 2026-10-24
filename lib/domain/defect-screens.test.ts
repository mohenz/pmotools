import { describe, expect, it } from "vitest";
import { matchScreen, normalizeCollectedUrl, screenPathKey, validateScreenRows, type ScreenEntry } from "@/lib/domain/defect-screens";

const s = (id: string, url: string | null, over: Partial<ScreenEntry> = {}): ScreenEntry => ({ id, path: id, url, name: "", isActive: true, createdAt: "2026-10-01", ...over });

describe("수집 URL 정규화", () => {
  it("호스트 소문자, 쿼리·해시·끝 슬래시 제거", () => {
    expect(normalizeCollectedUrl("HTTP://LocalHost:8080/Movie/list/?a=1#top")).toBe("http://localhost:8080/Movie/list");
    expect(normalizeCollectedUrl("http://localhost:8080/")).toBe("http://localhost:8080");
  });
  it("http/https가 아니거나 해석 불가면 null", () => {
    expect(normalizeCollectedUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeCollectedUrl("not a url")).toBeNull();
  });
});

describe("화면 매칭", () => {
  it("정확히 일치하는 항목을 고른다", () => {
    expect(matchScreen("http://localhost:8080/movies?x=1", [s("a", "http://localhost:8080/movies/"), s("b", "http://localhost:8080/other")])?.id).toBe("a");
  });
  it("와일드카드 패턴은 / 포함 임의 문자열과 일치", () => {
    expect(matchScreen("http://localhost:8080/movies/12/edit", [s("a", "http://localhost:8080/movies/*")])?.id).toBe("a");
  });
  it("여러 개면 와일드카드가 적고 긴 항목 우선", () => {
    const list = [s("a", "http://localhost:8080/*"), s("b", "http://localhost:8080/movies/*"), s("c", "http://localhost:8080/movies/12")];
    expect(matchScreen("http://localhost:8080/movies/12", list)?.id).toBe("c");
    expect(matchScreen("http://localhost:8080/movies/99", list)?.id).toBe("b");
  });
  it("같으면 먼저 등록된 항목", () => {
    const list = [s("late", "http://x.test/a", { createdAt: "2026-10-02" }), s("early", "http://x.test/a", { createdAt: "2026-10-01" })];
    expect(matchScreen("http://x.test/a", list)?.id).toBe("early");
  });
  it("사용 안 함·URL 없음·불일치는 제외한다", () => {
    expect(matchScreen("http://x.test/a", [s("a", "http://x.test/a", { isActive: false }), s("b", null), s("c", "http://x.test/b")])).toBeNull();
  });
});

describe("엑셀 행 검증", () => {
  const row = (n: number, path: string, url = "", name = "", active = "") => ({ rowNumber: n, path, url, name, active });
  it("정상 행은 통과하고 사용 여부 기본값은 Y", () => {
    const r = validateScreenRows([row(2, " 주문 > 목록 ", "https://a.test/orders", "주문목록"), row(3, "회원", "", "", "n")]);
    expect(r.errors).toEqual([]);
    expect(r.ok.map((o) => [o.path, o.isActive])).toEqual([["주문 > 목록", true], ["회원", false]]);
  });
  it("필수·URL·사용 여부 오류를 행 번호와 함께 모은다", () => {
    const r = validateScreenRows([row(2, ""), row(3, "a", "ftp://x"), row(4, "b", "", "", "X")]);
    expect(r.errors.map((e) => [e.rowNumber, e.field])).toEqual([[2, "화면경로"], [3, "화면 URL"], [4, "사용 여부"]]);
    expect(r.ok).toEqual([]);
  });
  it("파일 안 화면경로 중복(공백·대소문자 무시)", () => {
    const r = validateScreenRows([row(2, "Order  List"), row(3, "order list")]);
    expect(r.errors).toEqual([{ rowNumber: 3, field: "화면경로", message: "2행과 화면경로가 중복됩니다." }]);
    expect(screenPathKey("Order  List")).toBe("order list");
  });
});
