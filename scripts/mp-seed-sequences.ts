// ※ 2026-09-30부터 프로젝트를 화면(백오피스·pmotools 프로젝트 생성)으로 만들면 번호 시작점이 자동 발번된다
//   (projects.numberingBase + 순번 7종 선생성 — docs/번호시작점_자동발번_설계및작업계획_20260930.md).
//   이 스크립트는 DB에 직접 만든 프로젝트(테스트 데이터 스크립트 등)에만 쓴다. 시작점 기록과 7종 순번을 함께 설정한다.
// 다중 프로젝트 순번 구간 설정 (절차서 1-7 / 5-3, 결정 D-4)
// 표시 ID(WBS-YYYY-NNNNNN, WL-, REQ-, REQ-CHG-)는 시스템 전체에서 유일해야 하는데 순번은 프로젝트별로 1부터 시작한다.
// 새 프로젝트의 순번 시작값을 겹치지 않는 구간(100,000 단위)으로 미리 넣어 두면 원본 코드를 고치지 않고 충돌을 막는다.
//
// 사용법 (기본은 미리보기, --apply를 붙여야 실제 저장):
//   npx tsx --env-file=.env --conditions=react-server scripts/mp-seed-sequences.ts --project <프로젝트코드> --start 100000
//   npx tsx --env-file=.env --conditions=react-server scripts/mp-seed-sequences.ts --project <프로젝트코드> --start 100000 --apply
//
// 안전장치: 대상 프로젝트에 이미 순번 값이나 데이터가 있으면 중단한다(이미 발급된 ID와 구간이 섞이는 것을 막기 위함).
import { getPrisma } from "../lib/server/db-pg";

const args = process.argv.slice(2);
const arg = (name: string) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : undefined; };
const code = arg("project"), start = Number(arg("start")), apply = args.includes("--apply");

async function main() {
  if (!code || !Number.isInteger(start) || start <= 0 || start % 100000 !== 0 || start > 900000) {
    throw new Error("--project <코드> --start <100000 단위, 900000 이하> 를 지정하세요.");
  }
  const prisma = getPrisma();
  const project = await prisma.project.findUnique({ where: { code } });
  if (!project) throw new Error(`프로젝트 코드를 찾을 수 없습니다: ${code}`);
  const projectId = project.id;

  // 다른 프로젝트가 같은 구간을 이미 쓰고 있는지 확인 (순번 값이 [start, start+100000) 안에 있으면 충돌)
  const inRange = { gte: start, lt: start + 100000 };
  const others = await Promise.all([
    prisma.wbsItemSequence.findMany({ where: { projectId: { not: projectId }, value: inRange } }),
    prisma.workLogSequence.findMany({ where: { projectId: { not: projectId }, value: inRange } }),
    prisma.requirementSequence.findMany({ where: { projectId: { not: projectId }, value: inRange } }),
    prisma.requirementChangeSequence.findMany({ where: { projectId: { not: projectId }, value: inRange } }),
  ]);
  const baseTaken = await prisma.project.findFirst({ where: { numberingBase: start, id: { not: projectId } }, select: { code: true } });
  if (baseTaken) throw new Error(`구간 ${start}은 프로젝트 ${baseTaken.code}의 번호 시작점입니다. 다른 --start 값을 쓰세요.`);
  if (others.some((rows) => rows.length)) throw new Error(`구간 ${start}은 다른 프로젝트가 이미 사용 중입니다. 다른 --start 값을 쓰세요.`);

  const [seqs, counts] = await Promise.all([
    Promise.all([
      prisma.wbsItemSequence.findUnique({ where: { projectId } }), prisma.workLogSequence.findUnique({ where: { projectId } }),
      prisma.requirementSequence.findUnique({ where: { projectId } }), prisma.requirementChangeSequence.findUnique({ where: { projectId } }),
    ]),
    Promise.all([prisma.wbsItem.count({ where: { projectId } }), prisma.workLog.count({ where: { projectId } }), prisma.requirement.count({ where: { projectId } })]),
  ]);
  const existing = seqs.filter(Boolean).map((row) => row!.value);
  if (existing.some((value) => value > 0) || counts.some((count) => count > 0)) {
    throw new Error(`이미 순번 또는 데이터가 있어 중단합니다. 순번=${JSON.stringify(existing)} WBS/WL/REQ 건수=${JSON.stringify(counts)}`);
  }

  console.log(`[${apply ? "적용" : "미리보기"}] ${project.code} (${project.name}) 번호 시작점 ${start} → 다음 발급: WBS-YYYY-${String(start + 1).padStart(6, "0")}, WL-, REQ-, REQ-CHG-, ISU-, MT-, DT- 동일`);
  if (!apply) { console.log("실제 저장하려면 --apply 를 붙여 다시 실행하세요."); return; }
  await prisma.$transaction([
    prisma.wbsItemSequence.upsert({ where: { projectId }, create: { projectId, value: start }, update: { value: start } }),
    prisma.workLogSequence.upsert({ where: { projectId }, create: { projectId, value: start }, update: { value: start } }),
    prisma.requirementSequence.upsert({ where: { projectId }, create: { projectId, value: start }, update: { value: start } }),
    prisma.requirementChangeSequence.upsert({ where: { projectId }, create: { projectId, value: start }, update: { value: start } }),
    prisma.issueSequence.upsert({ where: { projectId }, create: { projectId, value: start }, update: { value: start } }),
    prisma.managementTaskSequence.upsert({ where: { projectId }, create: { projectId, value: start }, update: { value: start } }),
    prisma.pmoDelayedTaskSequence.upsert({ where: { projectId }, create: { projectId, value: start }, update: { value: start } }),
    prisma.project.update({ where: { id: projectId }, data: { numberingBase: start } }),
  ]);
  console.log("완료 — 번호 시작점 기록 + 순번 7종 시작값 저장");
}

main().then(() => process.exit(0)).catch((error) => { console.error("중단:", (error as Error).message); process.exit(1); });
