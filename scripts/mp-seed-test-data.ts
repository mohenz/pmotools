// 다중 프로젝트 메뉴(WBS2 · WBS상세내용2 · 요구사항관리2) 테스트 데이터 생성 — 로컬/개발 환경 전용
//
// 구조: 대표 프로젝트 EOCP(마일스톤 일정만) ─ PMO-DEMO · TEST-FO · TEST-BO · TEST-FO-APP (4개 같은 등급)
// 대표 프로젝트가 없으면 만들고 기존 프로젝트(기본 PMO-DEMO)를 그 아래로 옮긴 뒤, 가상 프로젝트 3개를 만들고 운영 절차(작업절차서 5단계)와 같은 순서로
// 멤버 → 순번 구간 → 공통코드·업무그룹을 준비한 뒤, 복사본 서버 로직(lib/server/mp)으로 WBS · 요구사항 · WBS상세내용을 등록한다.
//
//   미리보기: npx tsx --env-file=.env --conditions=react-server scripts/mp-seed-test-data.ts
//   생성:     npx tsx --env-file=.env --conditions=react-server scripts/mp-seed-test-data.ts --apply
//   삭제:     npx tsx --env-file=.env --conditions=react-server scripts/mp-seed-test-data.ts --reset
//   옵션:     --existing <대표 아래로 옮길 기존 프로젝트 코드> (기본 PMO-DEMO) · --actor <작업자 로그인ID> (기본 023017)
//
// 안전장치: 코드가 TEST- 로 시작하고 이름이 [테스트] 로 시작하는 프로젝트만 만들고 지운다. 이미 있으면 --apply를 중단한다.
//           대표 프로젝트 EOCP는 실제 코드이므로 --reset에서 지우지 않고, 이 스크립트가 넣은 마일스톤(설명 표식)만 지운다.
// 날짜는 실행일(KST) 기준 상대값이라 언제 실행해도 완료·지연·진행·예정이 섞인다.

// Next 런타임 밖에서 서버 로직을 호출하므로 캐시 API만 무시한다(데이터 저장에는 영향 없음).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextCache = require("next/cache");
nextCache.unstable_cache = (fn: (...args: unknown[]) => unknown) => fn;
nextCache.revalidateTag = () => {};
nextCache.revalidatePath = () => {};

import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : fallback; };
const APPLY = args.includes("--apply"), RESET = args.includes("--reset");
const EXISTING_CODE = arg("existing", "PMO-DEMO"), ACTOR_LOGIN = arg("actor", "023017");
const REP = { code: "EOCP", name: "이마트 온오프 통합커머스 플랫폼 구축", sequenceStart: 400000 };
const MILESTONE_MARK = "마일스톤 — 테스트 데이터";
// 대표 프로젝트 마일스톤: [이름, 실행일 기준 일수, 완료 여부] — 하루짜리 Task(계획시작=계획종료)로 등록
const MILESTONES: [string, number, boolean][] = [
  ["◆ 통합 착수(킥오프)", -60, true], ["◆ 요구사항 확정", -35, true], ["◆ 분석 단계 완료", -25, true],
  ["◆ FO·BO 화면설계 승인", -3, false], ["◆ 설계 단계 완료", 5, false], ["◆ 개발 완료(코드 프리즈)", 30, false],
  ["◆ 통합테스트 완료", 50, false], ["◆ 1차 오픈", 60, false], ["◆ 2차 오픈", 90, false], ["◆ 안정화 종료", 120, false],
];
// 대표 프로젝트 멤버 — 원본 WBS 규칙상 일반(MEMBER)은 본인 담당 Task만 보이므로, 마일스톤 전체 조회는 운영자 이상이 필요하다.
// 이승연은 일반으로 두어 "일반 멤버에게는 마일스톤이 보이지 않음"도 확인할 수 있게 한다.
const REP_MEMBERS: [string, Role][] = [["q93w28", "OPERATOR"], ["q93w20", "OPERATOR"], ["q93w36", "MEMBER"]];
const REP_VIEWERS = REP_MEMBERS.map(([login]) => login);

type Role = "ADMIN" | "OPERATOR" | "MEMBER";
type ProjectSpec = { code: string; name: string; parent: string; sequenceStart: number; groups: { code: string; label: string }[]; members: { login: string; role: Role; group: string }[] };

// 권한 테스트용 배치: 023017은 전부 ADMIN, q93w28(권태훈)은 FO=운영자·FO-APP=일반, q93w20(서호정)은 BO만 소속(FO 계열 선택 불가)
// 모든 가상 프로젝트는 대표 프로젝트(EOCP) 바로 아래, PMO-DEMO와 같은 등급
const PROJECTS: ProjectSpec[] = [
  { code: "TEST-FO", name: "[테스트] FO 채널 고도화", parent: REP.code, sequenceStart: 100000,
    groups: [{ code: "FO_PLAN", label: "FO 기획" }, { code: "DESIGN", label: "디자인" }, { code: "PUBLISH", label: "퍼블리싱" }, { code: "FO_DEV", label: "FO 개발" }],
    members: [{ login: "q93w28", role: "OPERATOR", group: "FO_PLAN" }, { login: "q93w36", role: "MEMBER", group: "FO_PLAN" }, { login: "q93w27", role: "MEMBER", group: "PUBLISH" }, { login: "q93w4i", role: "MEMBER", group: "DESIGN" }, { login: "q93w2c", role: "MEMBER", group: "FO_DEV" }] },
  { code: "TEST-BO", name: "[테스트] BO 운영 고도화", parent: REP.code, sequenceStart: 200000,
    groups: [{ code: "BO_PLAN", label: "BO 기획" }, { code: "BO_DEV", label: "BO 개발" }, { code: "PMO", label: "공통/PMO" }],
    members: [{ login: "q93w20", role: "OPERATOR", group: "BO_PLAN" }, { login: "q93w1z", role: "MEMBER", group: "BO_PLAN" }, { login: "q93w1x", role: "MEMBER", group: "BO_DEV" }, { login: "q93w2c", role: "MEMBER", group: "BO_DEV" }] },
  { code: "TEST-FO-APP", name: "[테스트] FO 모바일앱 리뉴얼", parent: REP.code, sequenceStart: 300000,
    groups: [{ code: "APP_PLAN", label: "앱 기획" }, { code: "APP_DEV", label: "앱 개발" }],
    members: [{ login: "q93w28", role: "MEMBER", group: "APP_PLAN" }, { login: "q93w36", role: "MEMBER", group: "APP_PLAN" }, { login: "q93w23", role: "MEMBER", group: "APP_DEV" }] },
];

// WBS: 단계 → 활동 → Task(leaf). 날짜는 실행일 기준 일수, state로 실적을 만든다.
type TaskState = "done" | "doneLate" | "progress" | "delayed" | "notStarted" | "future";
type TaskSpec = [name: string, owner: string, startOffset: number, days: number, state: TaskState, track: string];
const WBS: Record<string, { stage: string; activities: { name: string; tasks: TaskSpec[] }[] }[]> = {
  "TEST-FO": [
    { stage: "분석", activities: [{ name: "현행 분석", tasks: [["현행 FO 화면 인벤토리 작성", "q93w36", -40, 5, "done", "FO_PLANNING"], ["고객 여정 분석", "q93w28", -36, 7, "done", "FO_PLANNING"], ["경쟁사 벤치마킹", "q93w36", -30, 4, "doneLate", "FO_PLANNING"]] }] },
    { stage: "설계", activities: [
      { name: "화면 설계", tasks: [["메인 화면 설계", "q93w28", -20, 10, "done", "FO_PLANNING"], ["상품상세 화면 설계", "q93w36", -12, 8, "delayed", "FO_PLANNING"], ["장바구니 화면 설계", "q93w36", -5, 7, "progress", "FO_PLANNING"], ["주문서 화면 설계", "q93w28", 1, 6, "future", "FO_PLANNING"]] },
      { name: "디자인", tasks: [["디자인 가이드 정의", "q93w4i", -15, 5, "done", "DESIGN"], ["메인 디자인 시안", "q93w4i", -8, 6, "delayed", "DESIGN"], ["상품상세 디자인 시안", "q93w4i", -2, 5, "progress", "DESIGN"]] },
    ] },
    { stage: "구현", activities: [
      { name: "퍼블리싱", tasks: [["공통 레이아웃 퍼블리싱", "q93w27", -6, 4, "notStarted", "PUBLISHING"], ["메인 퍼블리싱", "q93w27", 2, 5, "future", "PUBLISHING"], ["상품상세 퍼블리싱", "q93w27", 7, 6, "future", "PUBLISHING"]] },
      { name: "FO 개발", tasks: [["FO 공통 컴포넌트 개발", "q93w2c", -10, 15, "progress", "DEV"], ["상품 API 연동", "q93w2c", -3, 2, "progress", "DEV"], ["주문 API 연동", "q93w2c", 5, 12, "future", "DEV"]] },
    ] },
    { stage: "테스트", activities: [{ name: "통합테스트", tasks: [["통합테스트 시나리오 작성", "q93w36", 10, 5, "future", "TESTER"], ["통합테스트 수행", "q93w28", 20, 10, "future", "TESTER"]] }] },
  ],
  "TEST-BO": [
    { stage: "분석", activities: [{ name: "요구 분석", tasks: [["BO 운영 요구사항 인터뷰", "q93w20", -35, 6, "done", "BO_PLANNING"], ["권한 체계 분석", "q93w1z", -28, 4, "doneLate", "BO_PLANNING"]] }] },
    { stage: "설계", activities: [{ name: "BO 화면 설계", tasks: [["상품관리 화면 설계", "q93w1z", -18, 8, "done", "BO_PLANNING"], ["전시관리 화면 설계", "q93w20", -9, 6, "delayed", "BO_PLANNING"], ["정산관리 화면 설계", "q93w1z", -1, 9, "progress", "BO_PLANNING"]] }] },
    { stage: "구현", activities: [{ name: "BO 개발", tasks: [["상품관리 API 개발", "q93w1x", -7, 12, "progress", "DEV"], ["전시관리 API 개발", "q93w2c", -4, 3, "notStarted", "DEV"], ["정산 배치 개발", "q93w1x", 6, 14, "future", "DEV"]] }] },
  ],
  "TEST-FO-APP": [
    { stage: "설계", activities: [{ name: "앱 화면 설계", tasks: [["앱 메인 설계", "q93w36", -14, 6, "done", "FO_PLANNING"], ["앱 푸시 정책 정의", "q93w28", -6, 3, "delayed", "FO_PLANNING"], ["앱 마이페이지 설계", "q93w36", 0, 8, "progress", "FO_PLANNING"]] }] },
    { stage: "구현", activities: [{ name: "앱 개발", tasks: [["앱 로그인 개발", "q93w23", -3, 7, "progress", "DEV"], ["앱 결제 연동", "q93w23", 4, 10, "future", "DEV"]] }] },
  ],
};

// 요구사항: [ID, 제목, 구분, 분류, 수용상태, 우선순위, 중요도, 담당]
type ReqSpec = [id: string, title: string, division: string, category: string, acceptance: string, priority: string, importance: string, owner: string];
const REQUIREMENTS: Record<string, ReqSpec[]> = {
  "TEST-FO": [
    ["FO-REQ-001", "메인 개인화 추천 영역 노출", "functional", "new", "accepted", "high", "high", "q93w28"],
    ["FO-REQ-002", "상품상세 옵션 선택 UX 개선", "functional", "improvement", "accepted", "high", "medium", "q93w36"],
    ["FO-REQ-003", "장바구니 쿠폰 즉시 적용", "functional", "new", "partially_accepted", "medium", "high", "q93w36"],
    ["FO-REQ-004", "주문서 배송지 주소록 연동", "functional", "improvement", "pending", "medium", "medium", "q93w28"],
    ["FO-REQ-005", "전 화면 웹접근성 AA 준수", "non_functional", "improvement", "accepted", "high", "high", "q93w27"],
    ["FO-REQ-006", "메인 LCP 2.5초 이내", "non_functional", "new", "deferred", "medium", "high", "q93w2c"],
    ["FO-REQ-007", "비회원 주문 조회", "functional", "new", "rejected", "low", "low", "q93w36"],
  ],
  "TEST-BO": [
    ["BO-REQ-001", "상품 일괄 등록(엑셀)", "functional", "new", "accepted", "high", "high", "q93w1z"],
    ["BO-REQ-002", "전시 코너 예약 게시", "functional", "new", "pending", "medium", "high", "q93w20"],
    ["BO-REQ-003", "정산 리포트 다운로드", "functional", "improvement", "accepted", "medium", "medium", "q93w1z"],
    ["BO-REQ-004", "메뉴 권한 역할별 관리", "non_functional", "improvement", "partially_accepted", "high", "high", "q93w20"],
    ["BO-REQ-005", "개인정보 마스킹", "non_functional", "new", "accepted", "high", "high", "q93w1x"],
  ],
  "TEST-FO-APP": [
    ["APP-REQ-001", "생체인증 로그인", "functional", "new", "accepted", "high", "high", "q93w36"],
    ["APP-REQ-002", "푸시 수신 동의 관리", "functional", "new", "pending", "medium", "medium", "q93w28"],
    ["APP-REQ-003", "앱 크래시율 0.1% 이하", "non_functional", "new", "accepted", "medium", "high", "q93w23"],
  ],
};

const kstToday = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

async function main() {
  const { getPrisma } = await import("../lib/server/db-pg");
  const prisma = getPrisma();
  const codes = PROJECTS.map((p) => p.code);
  const existing = await prisma.project.findMany({ where: { code: { in: codes } }, select: { code: true, name: true } });

  if (RESET) {
    const rep = await prisma.project.findUnique({ where: { code: REP.code } });
    if (rep) {
      // 마일스톤: 하위(Task)부터 지운다 — 상위 행이 남아 있으면 부모 참조 때문에 지울 수 없다
      const marked = { projectId: rep.id, description: MILESTONE_MARK };
      const leaves = await prisma.wbsItem.deleteMany({ where: { ...marked, parentId: { not: null } } });
      const heads = await prisma.wbsItem.deleteMany({ where: marked });
      console.log(`대표 프로젝트 ${REP.code} 마일스톤 삭제: ${leaves.count + heads.count}건 (프로젝트·계층 구조는 유지)`);
    }
    const deletable = existing.filter((p) => p.code.startsWith("TEST-") && p.name.startsWith("[테스트]"));
    // 하위부터 지운다(상위를 먼저 지우면 하위의 parentId만 비워지고 남는다)
    // 프로젝트 삭제의 연쇄 삭제 순서만으로는 WBS 진척 배정 → 공통코드 RESTRICT 제약에 걸리므로, 참조하는 데이터부터 명시적으로 지운다.
    for (const code of [...codes].reverse()) {
      if (!deletable.some((p) => p.code === code)) continue;
      const { id: projectId } = await prisma.project.findUniqueOrThrow({ where: { code } });
      await prisma.$transaction([
        prisma.wbsAssignment.deleteMany({ where: { wbsItem: { projectId } } }),
        prisma.wbsItem.updateMany({ where: { projectId }, data: { parentId: null } }),
        prisma.wbsItem.deleteMany({ where: { projectId } }),
        prisma.workLog.deleteMany({ where: { projectId } }),
        prisma.requirement.deleteMany({ where: { projectId } }),
        prisma.project.delete({ where: { id: projectId } }),
      ]);
    }
    console.log(`삭제 완료: ${deletable.map((p) => p.code).join(", ") || "(대상 없음)"}`);
    return;
  }
  if (existing.length) throw new Error(`이미 있는 테스트 프로젝트: ${existing.map((p) => p.code).join(", ")} — --reset 후 다시 실행하세요.`);

  const parent = await prisma.project.findUnique({ where: { code: EXISTING_CODE } });
  if (!parent) throw new Error(`기존 프로젝트를 찾을 수 없습니다: ${EXISTING_CODE}`);
  const logins = [...new Set([ACTOR_LOGIN, ...REP_VIEWERS, ...PROJECTS.flatMap((p) => p.members.map((m) => m.login))])];
  const users = await prisma.user.findMany({ where: { userId: { in: logins } }, select: { id: true, userId: true, name: true } });
  const userId = (login: string) => { const user = users.find((u) => u.userId === login); if (!user) throw new Error(`사용자 없음: ${login}`); return user.id; };
  logins.forEach(userId);
  const today = kstToday();

  const repExisting = await prisma.project.findUnique({ where: { code: REP.code } });
  console.log(`[${APPLY ? "생성" : "미리보기"}] 대표 ${REP.code}(${repExisting ? "기존" : "신규"}) ─ ${EXISTING_CODE}(기존, 대표 아래로 이동) + 가상 ${PROJECTS.length}개 · 기준일 ${today} · 작업자 ${ACTOR_LOGIN}`);
  console.log(`  ${REP.code} ${REP.name} · 순번 ${REP.sequenceStart} · 마일스톤 ${MILESTONES.length}건`);
  for (const spec of PROJECTS) {
    const tasks = WBS[spec.code].flatMap((s) => s.activities.flatMap((a) => a.tasks));
    console.log(`  ${spec.code} ${spec.name} (상위 ${spec.parent}) · 순번 ${spec.sequenceStart} · 멤버 ${spec.members.length + 1} · WBS Task ${tasks.length} · 요구사항 ${REQUIREMENTS[spec.code].length}`);
  }
  if (!APPLY) { console.log("실제 생성하려면 --apply 를 붙이세요."); return; }

  const mpWbs = await import("../lib/server/mp/wbs");
  const mpReq = await import("../lib/server/mp/requirements");
  const mpWl = await import("../lib/server/mp/work-logs");
  const actor = userId(ACTOR_LOGIN);
  const systemGroups = await prisma.commonCodeGroup.findMany({ where: { projectId: parent.id, OR: [{ isSystem: true }, { code: "CRITICAL_PATH" }] }, include: { codes: true } });
  const summary: string[] = [];

  // 0) 대표 프로젝트 — 없으면 만들고, 기존 프로젝트를 그 아래로 옮긴다(같은 등급 구조)
  const rep = repExisting ?? await prisma.project.create({ data: { code: REP.code, name: REP.name, description: "대표 프로젝트 — 하위 프로젝트를 묶고 마일스톤 기준 일정만 관리", customerName: "이마트", vendorName: "신세계 I&C", vendorPm: "정재균", startDate: new Date(`${shift(today, -60)}T00:00:00Z`), endDate: new Date(`${shift(today, 120)}T00:00:00Z`) } });
  if (parent.parentId !== rep.id) { await prisma.project.update({ where: { id: parent.id }, data: { parentId: rep.id } }); console.log(`  ${EXISTING_CODE} 상위 프로젝트 → ${REP.code}`); }
  for (const [login, role] of [[ACTOR_LOGIN, "ADMIN"], ...REP_MEMBERS] as [string, Role][]) {
    await prisma.projectMember.upsert({ where: { projectId_userId: { projectId: rep.id, userId: userId(login) } }, create: { projectId: rep.id, userId: userId(login), role }, update: { role, isActive: true } });
  }
  if (!(await prisma.commonCodeGroup.count({ where: { projectId: rep.id } }))) {
    for (const group of systemGroups) {
      const created = await prisma.commonCodeGroup.create({ data: { projectId: rep.id, code: group.code, label: group.label, description: group.description, sortOrder: group.sortOrder, isActive: group.isActive, isSystem: group.isSystem } });
      await prisma.commonCode.createMany({ data: group.codes.map((code) => ({ projectId: rep.id, groupId: created.id, groupCode: group.code, code: code.code, label: code.label, sortOrder: code.sortOrder, isActive: code.isActive, minScore: code.minScore })) });
    }
  }
  const repSeq = await prisma.wbsItemSequence.findUnique({ where: { projectId: rep.id } });
  if (!repSeq && !(await prisma.wbsItem.count({ where: { projectId: rep.id } }))) execSync(`npx tsx --env-file=.env --conditions=react-server scripts/mp-seed-sequences.ts --project ${REP.code} --start ${REP.sequenceStart} --apply`, { stdio: "pipe" });
  if (await prisma.wbsItem.count({ where: { projectId: rep.id, description: MILESTONE_MARK } })) {
    console.log(`  ${REP.code} 마일스톤이 이미 있어 건너뜀`);
  } else {
    const head = await mpWbs.createWbsItem(rep.id, actor, { name: "통합 마일스톤", description: MILESTONE_MARK });
    for (const [name, offset, done] of MILESTONES) {
      const date = shift(today, offset);
      await mpWbs.createWbsItem(rep.id, actor, { name, description: MILESTONE_MARK, parentId: head.id, ownerUserId: actor, startDate: date, dueDate: date, ...(done ? { actualStartDate: date, actualDueDate: date } : {}) });
    }
    summary.push(`${REP.code}: 마일스톤 ${MILESTONES.length}건 (완료 ${MILESTONES.filter((m) => m[2]).length}, 지연 1, 예정 ${MILESTONES.filter((m) => !m[2] && m[1] >= 0).length})`);
  }

  for (const spec of PROJECTS) {
    const parentProject = await prisma.project.findUniqueOrThrow({ where: { code: spec.parent } });
    const project = await prisma.project.create({ data: { code: spec.code, name: spec.name, parentId: parentProject.id, description: "다중 프로젝트 메뉴 테스트 데이터 (scripts/mp-seed-test-data.ts)", startDate: new Date(`${shift(today, -45)}T00:00:00Z`), endDate: new Date(`${shift(today, 60)}T00:00:00Z`), customerName: "이마트", vendorName: "신세계 I&C", vendorPm: "정재균" } });
    const projectId = project.id;

    // 1) 멤버 (5-2)
    await prisma.projectMember.createMany({ data: [{ projectId, userId: actor, role: "ADMIN" }, ...spec.members.map((m) => ({ projectId, userId: userId(m.login), role: m.role }))] });
    // 2) 순번 구간 (5-3) — 운영과 같은 스크립트를 그대로 실행
    execSync(`npx tsx --env-file=.env --conditions=react-server scripts/mp-seed-sequences.ts --project ${spec.code} --start ${spec.sequenceStart} --apply`, { stdio: "pipe" });
    // 3) 공통코드 (5-4) — 상위 프로젝트의 시스템 코드 구성을 복사
    const trackIds = new Map<string, string>(), reqCodeIds = new Map<string, string>();
    for (const group of systemGroups) {
      const created = await prisma.commonCodeGroup.create({ data: { projectId, code: group.code, label: group.label, description: group.description, sortOrder: group.sortOrder, isActive: group.isActive, isSystem: group.isSystem } });
      for (const code of group.codes) {
        const row = await prisma.commonCode.create({ data: { projectId, groupId: created.id, groupCode: group.code, code: code.code, label: code.label, sortOrder: code.sortOrder, isActive: code.isActive, minScore: code.minScore } });
        if (group.code === "WBS_WORK_GROUP") trackIds.set(code.code, row.id);
        if (group.code === "requirement_division" || group.code === "requirement_category") reqCodeIds.set(code.code, row.id);
      }
    }
    // 4) 업무그룹·소속 (5-5)
    const groupIds = new Map<string, string>();
    for (const [index, group] of spec.groups.entries()) groupIds.set(group.code, (await prisma.groups.create({ data: { projectId, groupType: "WORK_MODULE", code: group.code, label: group.label, sortOrder: index } })).id);
    await prisma.userGroupMap.createMany({ data: spec.members.map((m) => ({ userId: userId(m.login), groupId: groupIds.get(m.group)! })) });

    // 5) WBS — 복사본 서버 로직으로 등록
    let taskCount = 0;
    const taskCodes: { code: string; owner: string }[] = [];
    for (const stage of WBS[spec.code]) {
      const stageItem = await mpWbs.createWbsItem(projectId, actor, { name: stage.stage });
      for (const activity of stage.activities) {
        const activityItem = await mpWbs.createWbsItem(projectId, actor, { name: activity.name, parentId: stageItem.id });
        for (const [name, owner, startOffset, days, state, track] of activity.tasks) {
          const start = shift(today, startOffset), due = shift(today, startOffset + days - 1);
          const actual = state === "done" ? { actualStartDate: start, actualDueDate: due }
            : state === "doneLate" ? { actualStartDate: start, actualDueDate: shift(due, 3) }
            : state === "progress" || state === "delayed" ? { actualStartDate: start } : {};
          const task = await mpWbs.createWbsItem(projectId, actor, { name, parentId: activityItem.id, ownerUserId: userId(owner), groupId: trackIds.get(track) ?? null, startDate: start, dueDate: due, ...actual });
          const percent = state === "progress" ? 50 : state === "delayed" ? 70 : 0;
          if (percent && trackIds.get(track)) await mpWbs.updateWbsAssignments(projectId, actor, task.id, { version: task.version, assignments: [{ groupId: trackIds.get(track)!, progressPercent: percent }] });
          taskCount += 1;
          const row = await prisma.wbsItem.findUniqueOrThrow({ where: { id: task.id }, select: { path: true } });
          taskCodes.push({ code: row.path.split(".").map(Number).join("."), owner });
        }
      }
    }

    // 6) 요구사항 + 변경요청
    const reqIds: string[] = [];
    for (const [requirementId, title, division, category, acceptance, priority, importance, owner] of REQUIREMENTS[spec.code]) {
      const created = await mpReq.createRequirement(projectId, actor, { requirementId, title, content: `${title} — 테스트 데이터`, ownerUserId: userId(owner), divisionCodeId: reqCodeIds.get(division) ?? null, categoryCodeId: reqCodeIds.get(category) ?? null, acceptanceStatus: acceptance, priority, importance, registrationDate: shift(today, -30), requestDepartment: spec.code === "TEST-BO" ? "이마트 운영팀" : "이마트 디지털팀" });
      reqIds.push(created.id);
    }
    await mpReq.createRequirementChange(projectId, actor, reqIds[0], { title: "범위 조정 요청", changeReason: "고객사 리뷰 결과 노출 조건 추가", proposedContent: "노출 조건에 회원 등급 추가 — 테스트 데이터" });
    await mpReq.createRequirementChange(projectId, actor, reqIds[1], { title: "일정 조정 요청", changeReason: "선행 API 일정 지연", proposedContent: "2차 오픈으로 이관 — 테스트 데이터" });

    // 7) WBS상세내용 — 멤버 본인 업무그룹으로 작성
    let workLogCount = 0;
    for (const [index, member] of spec.members.entries()) {
      const owned = taskCodes.filter((t) => t.owner === member.login);
      for (const [offset, task] of owned.slice(0, 2).entries()) {
        await mpWl.createWorkLog(projectId, userId(member.login), { workDate: shift(today, -(index + offset + 1)), groupId: groupIds.get(member.group)!, wbsNumber: task.code, status: offset === 0 ? "COMPLETED" : "IN_PROGRESS", workContent: `${task.code} 작업 진행 — 테스트 데이터`, deliverableName: offset === 0 ? "산출물 초안" : "" });
        workLogCount += 1;
      }
    }
    const ids = await prisma.wbsItem.findFirst({ where: { projectId }, orderBy: { displayId: "asc" }, select: { displayId: true } });
    summary.push(`${spec.code}: WBS ${taskCount}건(+단계·활동), 요구사항 ${reqIds.length}건·변경 2건, WBS상세내용 ${workLogCount}건, 첫 WBS ID ${ids?.displayId}`);
  }
  console.log("완료\n  " + summary.join("\n  "));
}

main().then(() => process.exit(0)).catch((error) => { console.error("중단:", (error as Error).message); process.exit(1); });
