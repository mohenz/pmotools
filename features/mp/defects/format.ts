// 결함관리 화면 공통 표시 형식 — 날짜는 Intl + ko-KR(Bloom 표준 11장).
const dateFmt = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" });
const dateTimeFmt = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });

export const fmtDate = (value: string | null | undefined) => (value ? dateFmt.format(new Date(value.length === 10 ? `${value}T00:00:00+09:00` : value)) : "–");
export const fmtDateTime = (value: string | null | undefined) => (value ? dateTimeFmt.format(new Date(value)) : "–");
export const fmtNumber = (value: number) => new Intl.NumberFormat("ko-KR").format(value);

export const SOURCE_LABEL: Record<string, string> = { MANUAL: "직접 등록", ENTRY: "케이스에서 진입", WIDGET: "위젯", EXTENSION: "확장 프로그램" };
