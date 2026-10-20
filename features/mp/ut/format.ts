// 단위테스트 화면 표시 형식 — 서버·클라이언트 컴포넌트 공용(지시어 없음).
export const dot = (value: string | null | undefined) => (value ? value.replaceAll("-", ".") : "–");
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export const STATUS_BAND: Record<string, string> = {
  DRAFT: "", REVIEW_REQUESTED: "band-yellow", APPROVED: "band-green", REJECTED: "band-red",
  IN_EXECUTION: "band-yellow", QC_PENDING: "band-yellow", PL_PENDING: "band-yellow", PL_CONFIRMED: "band-green",
  REGISTERED: "band-red", FIXED: "band-yellow", VERIFIED: "band-green", REFIX: "band-red",
  PASS: "band-green", FAIL: "band-red", BLOCKED: "band-yellow", NA: "",
};
