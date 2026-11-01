// 공공데이터포털 "한국천문연구원 특일 정보"에서 국경일·공휴일(대체·임시공휴일 포함)을 가져와 holidays 테이블(전사 공통)에 반영한다.
// 사용: npx tsx scripts/sync-holidays.ts 2026 2027          → 미리보기(DB 변경 없음)
//       npx tsx scripts/sync-holidays.ts 2026 2027 --apply  → 반영(없는 날짜 추가, 이름이 바뀐 날짜 갱신. 삭제는 하지 않는다)
//       npx tsx scripts/sync-holidays.ts --file docs/holidays-2026-2027.md [--apply]  → API 대신 md 표 파일에서 읽는다(인증키·인터넷 불필요)
// 인증키는 환경변수 DATA_GO_KR_SERVICE_KEY(.env.local)에서 읽는다(--file이면 필요 없음).
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { readFileSync } from "node:fs";
import { mergeHolidaysByDate, parseHolidayMarkdown, parseRestDeResponse, type PublicHoliday } from "../lib/domain/public-holidays";

const ENDPOINT = "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";

async function fetchYear(year: number, serviceKey: string): Promise<PublicHoliday[]> {
  const all: PublicHoliday[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const url = `${ENDPOINT}?solYear=${year}&solMonth=${String(month).padStart(2, "0")}&numOfRows=50&_type=json&ServiceKey=${encodeURIComponent(serviceKey)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${year}-${month} 조회 실패: HTTP ${response.status}`);
    const text = await response.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { throw new Error(`${year}-${month} 응답이 JSON이 아닙니다(인증키·활용신청 상태를 확인하세요): ${text.slice(0, 200)}`); }
    all.push(...parseRestDeResponse(json));
  }
  return all;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const fileIndex = args.indexOf("--file");
  const file = fileIndex >= 0 ? args[fileIndex + 1] : undefined;
  if (fileIndex >= 0 && !file) throw new Error("--file 뒤에 md 파일 경로를 지정하세요.");
  let years = args.filter((arg) => /^\d{4}$/.test(arg)).map(Number);
  let holidays: PublicHoliday[];
  if (file) {
    holidays = mergeHolidaysByDate(parseHolidayMarkdown(readFileSync(file, "utf-8")));
    if (!holidays.length) throw new Error(`${file}에서 휴일 행(| YYYY-MM-DD | 요일 | 이름 |)을 찾지 못했습니다.`);
    years = [...new Set(holidays.map((holiday) => Number(holiday.date.slice(0, 4))))];
  } else {
    const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
    if (!years.length) throw new Error("연도를 하나 이상 지정하세요. 예: npx tsx scripts/sync-holidays.ts 2026 2027 [--apply]");
    if (!serviceKey) throw new Error("환경변수 DATA_GO_KR_SERVICE_KEY가 없습니다(.env.local에 설정).");
    holidays = mergeHolidaysByDate((await Promise.all(years.map((year) => fetchYear(year, serviceKey)))).flat());
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const existing = await prisma.holiday.findMany({ where: { projectId: null, date: { gte: new Date(`${Math.min(...years)}-01-01T00:00:00.000Z`), lte: new Date(`${Math.max(...years)}-12-31T00:00:00.000Z`) } } });
    const byDate = new Map(existing.map((row) => [row.date.toISOString().slice(0, 10), row]));
    let added = 0, renamed = 0, same = 0;
    for (const holiday of holidays) {
      const row = byDate.get(holiday.date);
      const state = !row ? "추가" : row.label !== holiday.label ? `갱신(기존: ${row.label})` : "동일";
      console.log(`${holiday.date}  ${holiday.label}  [${state}]`);
      if (!row) { added += 1; if (apply) await prisma.holiday.create({ data: { projectId: null, date: new Date(`${holiday.date}T00:00:00.000Z`), label: holiday.label } }); }
      else if (row.label !== holiday.label) { renamed += 1; if (apply) await prisma.holiday.update({ where: { id: row.id }, data: { label: holiday.label } }); }
      else same += 1;
    }
    const missing = existing.filter((row) => !holidays.some((holiday) => holiday.date === row.date.toISOString().slice(0, 10)));
    for (const row of missing) console.log(`${row.date.toISOString().slice(0, 10)}  ${row.label}  [DB에만 있음 — 삭제하지 않음]`);
    console.log(`\n${years.join(", ")}년: ${file ? "파일" : "API"} ${holidays.length}건 · 추가 ${added} · 갱신 ${renamed} · 동일 ${same} · DB에만 있음 ${missing.length}`);
    console.log(apply ? "holidays 테이블에 반영했습니다." : "미리보기입니다. 반영하려면 --apply를 붙여 다시 실행하세요.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
