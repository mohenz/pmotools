// 공공데이터포털 한국천문연구원 "특일 정보"(getRestDeInfo) 응답을 휴일 행으로 바꾼다. 네트워크·DB 의존이 없는 순수 함수.

export type PublicHoliday = { date: string; label: string };

type RestDeItem = { locdate?: number | string; dateName?: string; isHoliday?: string };

/** 응답 JSON에서 휴일 목록을 꺼낸다. 결과가 1건이면 item이 배열이 아닌 객체로, 0건이면 빈 문자열로 온다. */
export function parseRestDeResponse(json: unknown): PublicHoliday[] {
  const items = (json as { response?: { body?: { items?: { item?: RestDeItem | RestDeItem[] } | "" } } })?.response?.body?.items;
  if (!items || typeof items !== "object" || !items.item) return [];
  const list = Array.isArray(items.item) ? items.item : [items.item];
  const result: PublicHoliday[] = [];
  for (const item of list) {
    const digits = String(item.locdate ?? "");
    if (!/^\d{8}$/.test(digits) || item.isHoliday !== "Y" || !item.dateName) continue;
    result.push({ date: `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`, label: item.dateName.trim() });
  }
  return result;
}

/** 같은 날짜에 이름이 여러 개면 한 줄로 합친다(예: 어린이날 + 대체공휴일). 날짜순. */
export function mergeHolidaysByDate(holidays: PublicHoliday[]): PublicHoliday[] {
  const byDate = new Map<string, string[]>();
  for (const { date, label } of holidays) {
    const labels = byDate.get(date) ?? [];
    if (!labels.includes(label)) labels.push(label);
    byDate.set(date, labels);
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, labels]) => ({ date, label: labels.join(", ") }));
}

/** 마크다운 표(`| YYYY-MM-DD | 요일 | 이름 |`)에서 휴일을 읽는다. 날짜로 시작하지 않는 줄(제목·머리글·구분선)은 무시한다. */
export function parseHolidayMarkdown(text: string): PublicHoliday[] {
  const result: PublicHoliday[] = [];
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells.length < 4 || !/^\d{4}-\d{2}-\d{2}$/.test(cells[1])) continue;
    const label = cells[cells.length - 2];
    if (label) result.push({ date: cells[1], label });
  }
  return result;
}
