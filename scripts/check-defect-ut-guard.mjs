// 결함관리 무변경 보증(설계서 8장, 규칙 1) — 단위테스트 프로그램·데이터 정의가 바뀌지 않았는지 점검한다.
//   1) 단위테스트 관련 경로에 커밋되지 않은 변경·신규 파일이 없다.
//   2) prisma/schema.prisma 의 Ut* · WbsItem · Requirement 모델이 HEAD 와 같다(결함 모델은 소프트 참조만 쓴다).
//   3) 결함관리 마이그레이션이 ut_* · wbs_items · requirements 를 참조(FK)하거나 변경하지 않는다.
// 사용: node scripts/check-defect-ut-guard.mjs   (이상이 있으면 종료 코드 1)
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const PROTECTED = ["screens/mp/ut", "lib/server/mp/ut", "lib/domain/ut.ts", "lib/domain/ut.test.ts", "features/mp/ut", "app/mp-ut", "app/api/v1/mp/ut"];
const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const problems = [];

// 1) 경로 변경 여부
const existing = PROTECTED.filter((p) => existsSync(p));
const status = git("status", "--porcelain", "--", ...existing).trim();
if (status) problems.push(`단위테스트 경로에 변경이 있습니다:\n${status}`);
const utDomain = readdirSync("lib/domain").filter((f) => /^ut/.test(f)).map((f) => `lib/domain/${f}`);
const domainStatus = utDomain.length ? git("status", "--porcelain", "--", ...utDomain).trim() : "";
if (domainStatus) problems.push(`lib/domain/ut* 에 변경이 있습니다:\n${domainStatus}`);

// 2) 스키마 모델 동일성
const modelBlocks = (text) => {
  const out = new Map();
  for (const m of text.matchAll(/^model (\w+) \{[\s\S]*?^\}/gm)) out.set(m[1], m[0].replace(/\s+$/gm, ""));
  return out;
};
const head = modelBlocks(git("show", "HEAD:prisma/schema.prisma"));
const work = modelBlocks(readFileSync("prisma/schema.prisma", "utf8"));
for (const name of new Set([...head.keys(), ...work.keys()])) {
  if (!(/^Ut/.test(name) || name === "WbsItem" || name === "Requirement")) continue;
  if (head.get(name) !== work.get(name)) problems.push(`모델 ${name} 정의가 HEAD 와 다릅니다.`);
}
const strayRef = [...work].filter(([name, body]) => /^Defect|^WbsItemTestStage/.test(name) && /@relation\([^)]*references[^)]*\)/.test(body) && /\b(UtCase|UtExecution|UtDefect|WbsItem|Requirement)\b\s+@relation/.test(body));
for (const [name] of strayRef) problems.push(`모델 ${name} 이 단위테스트·WBS·요구사항 모델과 관계(FK)를 가집니다.`);

// 3) 결함관리 마이그레이션
const dir = readdirSync("prisma/migrations").find((d) => d.endsWith("_defect_management"));
if (!dir) problems.push("결함관리 마이그레이션을 찾을 수 없습니다.");
else {
  const sql = readFileSync(`prisma/migrations/${dir}/migration.sql`, "utf8");
  if (/REFERENCES\s+"?(ut_\w+|wbs_items|requirements)"?/i.test(sql)) problems.push("마이그레이션이 ut_* · wbs_items · requirements 를 참조합니다.");
  if (/(ALTER|DROP)\s+TABLE\s+"?(ut_\w+|wbs_items|requirements)"?/i.test(sql)) problems.push("마이그레이션이 ut_* · wbs_items · requirements 를 변경합니다.");
}

if (problems.length) { console.error(`무변경 점검 실패 (${problems.length}건)\n- ${problems.join("\n- ")}`); process.exit(1); }
console.log("무변경 점검 통과: 단위테스트 경로·모델·마이그레이션 변경 없음");
