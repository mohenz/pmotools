import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: false });

import { hashSync } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const rawConnectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL_NON_POOLING;
if (!rawConnectionString) throw new Error("DATABASE_URL is not set.");
const connectionString = rawConnectionString.replace(/sslmode=require/, "sslmode=no-verify");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const PROJECT_ID = "20000000-0000-4000-8000-000000000001";
const ADMIN_USER_ID = "10000000-0000-4000-8000-000000000001";
const ADMIN_LOGIN_ID = "pmo.admin";
const ADMIN_TEMP_PASSWORD = "ChangeMe!2026";

const GROUP_IDS = {
  trackA: "30000000-0000-4000-8000-000000000001",
  trackB: "30000000-0000-4000-8000-000000000002",
  trackC: "30000000-0000-4000-8000-000000000003",
  trackD: "30000000-0000-4000-8000-000000000004",
  common: "30000000-0000-4000-8000-000000000005",
} as const;

const CATEGORY_GROUP_ID = "70000000-0000-4000-8000-000000000001";
const ESCALATION_GROUP_ID = "70000000-0000-4000-8000-000000000003";

const CATEGORY_CODE_IDS = {
  schedule: "50000000-0000-4000-8000-000000000001",
  cost: "50000000-0000-4000-8000-000000000002",
  quality: "50000000-0000-4000-8000-000000000003",
  organization: "50000000-0000-4000-8000-000000000004",
  contract: "50000000-0000-4000-8000-000000000005",
  reputation: "50000000-0000-4000-8000-000000000006",
} as const;

const ESCALATION_CODE_IDS = {
  pm: "60000000-0000-4000-8000-000000000001",
  departmentHead: "60000000-0000-4000-8000-000000000002",
  cLevel: "60000000-0000-4000-8000-000000000003",
} as const;

async function main() {
  const existing = await prisma.project.findUnique({ where: { id: PROJECT_ID } });
  if (existing) {
    await prisma.meetingRoom.createMany({
      data: [
        { projectId: PROJECT_ID, name: "대회의실", roomType: "LARGE", capacity: 20, floor: "3F", equipment: ["빔프로젝터", "화상회의"] },
        { projectId: PROJECT_ID, name: "소회의실 A", roomType: "SMALL", capacity: 6, floor: "3F", equipment: ["모니터"] },
        { projectId: PROJECT_ID, name: "소회의실 B", roomType: "SMALL", capacity: 6, floor: "3F", equipment: ["모니터"] },
        { projectId: PROJECT_ID, name: "소회의실 C", roomType: "SMALL", capacity: 6, floor: "4F", equipment: ["화이트보드"] },
        { projectId: PROJECT_ID, name: "소회의실 D", roomType: "SMALL", capacity: 6, floor: "4F", equipment: [] },
        { projectId: PROJECT_ID, name: "소회의실 E", roomType: "SMALL", capacity: 6, floor: "4F", equipment: ["모니터", "화상회의"] },
      ],
      skipDuplicates: true,
    });
    console.log("Seed data already present — skipping.");
    return;
  }

  await prisma.project.create({
    data: {
      id: PROJECT_ID,
      code: "PMO-DEMO",
      name: "PMO 통제 프로젝트",
      openMethod: "phased",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-12-31"),
      firstOpenDate: new Date("2026-10-01"),
      secondOpenDate: new Date("2026-12-01"),
      customerName: "발주사",
      vendorName: "수행사",
      customerPm: "발주사 PM",
      customerPmoCount: 1,
      vendorPm: "수행사 PM",
      vendorPmoCount: 1,
      projectGrade: "B",
      timezone: "Asia/Seoul",
      staleBusinessDays: 3,
    },
  });

  await prisma.user.create({
    data: {
      id: ADMIN_USER_ID,
      userId: ADMIN_LOGIN_ID,
      name: "PMO 관리자",
      passwordHash: hashSync(ADMIN_TEMP_PASSWORD, 12),
      email: "local.pmo@example.com",
      department: "PMO",
      role: "ADMIN",
    },
  });

  await prisma.projectMember.create({
    data: { projectId: PROJECT_ID, userId: ADMIN_USER_ID, role: "ADMIN" },
  });

  await prisma.meetingRoom.createMany({
    data: [
      { projectId: PROJECT_ID, name: "대회의실", roomType: "LARGE", capacity: 20, floor: "3F", equipment: ["빔프로젝터", "화상회의"] },
      { projectId: PROJECT_ID, name: "소회의실 A", roomType: "SMALL", capacity: 6, floor: "3F", equipment: ["모니터"] },
      { projectId: PROJECT_ID, name: "소회의실 B", roomType: "SMALL", capacity: 6, floor: "3F", equipment: ["모니터"] },
      { projectId: PROJECT_ID, name: "소회의실 C", roomType: "SMALL", capacity: 6, floor: "4F", equipment: ["화이트보드"] },
      { projectId: PROJECT_ID, name: "소회의실 D", roomType: "SMALL", capacity: 6, floor: "4F", equipment: [] },
      { projectId: PROJECT_ID, name: "소회의실 E", roomType: "SMALL", capacity: 6, floor: "4F", equipment: ["모니터", "화상회의"] },
    ],
  });

  await prisma.groups.createMany({
    data: [
      { id: GROUP_IDS.trackA, projectId: PROJECT_ID, groupType: "WORK_MODULE", code: "TRACK_A", label: "Track A", sortOrder: 1 },
      { id: GROUP_IDS.trackB, projectId: PROJECT_ID, groupType: "WORK_MODULE", code: "TRACK_B", label: "Track B", sortOrder: 2 },
      { id: GROUP_IDS.trackC, projectId: PROJECT_ID, groupType: "WORK_MODULE", code: "TRACK_C", label: "Track C", sortOrder: 3 },
      { id: GROUP_IDS.trackD, projectId: PROJECT_ID, groupType: "WORK_MODULE", code: "TRACK_D", label: "Track D", sortOrder: 4 },
      { id: GROUP_IDS.common, projectId: PROJECT_ID, groupType: "WORK_MODULE", code: "COMMON", label: "공통/PMO", sortOrder: 5 },
    ],
  });

  await prisma.commonCodeGroup.create({
    data: { id: CATEGORY_GROUP_ID, projectId: PROJECT_ID, code: "category", label: "유형", description: "이슈·리스크 분류 유형", sortOrder: 1, isSystem: true },
  });
  await prisma.commonCodeGroup.create({
    data: { id: ESCALATION_GROUP_ID, projectId: PROJECT_ID, code: "escalation_level", label: "에스컬레이션 레벨", description: "확률×영향 점수별 보고 수준", sortOrder: 3, isSystem: true },
  });

  await prisma.commonCode.createMany({
    data: [
      { id: CATEGORY_CODE_IDS.schedule, projectId: PROJECT_ID, groupId: CATEGORY_GROUP_ID, groupCode: "category", code: "schedule", label: "일정", sortOrder: 1 },
      { id: CATEGORY_CODE_IDS.cost, projectId: PROJECT_ID, groupId: CATEGORY_GROUP_ID, groupCode: "category", code: "cost", label: "비용", sortOrder: 2 },
      { id: CATEGORY_CODE_IDS.quality, projectId: PROJECT_ID, groupId: CATEGORY_GROUP_ID, groupCode: "category", code: "quality", label: "품질", sortOrder: 3 },
      { id: CATEGORY_CODE_IDS.organization, projectId: PROJECT_ID, groupId: CATEGORY_GROUP_ID, groupCode: "category", code: "organization", label: "조직/정치", sortOrder: 4 },
      { id: CATEGORY_CODE_IDS.contract, projectId: PROJECT_ID, groupId: CATEGORY_GROUP_ID, groupCode: "category", code: "contract", label: "계약", sortOrder: 5 },
      { id: CATEGORY_CODE_IDS.reputation, projectId: PROJECT_ID, groupId: CATEGORY_GROUP_ID, groupCode: "category", code: "reputation", label: "대외 평판", sortOrder: 6 },
      { id: ESCALATION_CODE_IDS.pm, projectId: PROJECT_ID, groupId: ESCALATION_GROUP_ID, groupCode: "escalation_level", code: "pm", label: "PM 레벨", sortOrder: 1, minScore: 1 },
      { id: ESCALATION_CODE_IDS.departmentHead, projectId: PROJECT_ID, groupId: ESCALATION_GROUP_ID, groupCode: "escalation_level", code: "department_head", label: "본부장 레벨", sortOrder: 2, minScore: 4 },
      { id: ESCALATION_CODE_IDS.cLevel, projectId: PROJECT_ID, groupId: ESCALATION_GROUP_ID, groupCode: "escalation_level", code: "c_level", label: "C-Level 레벨", sortOrder: 3, minScore: 7 },
    ],
  });

  const itemSeeds = [
    { id: "40000000-0000-4000-8000-000000000001", displayId: "IR-2026-000001", groupId: GROUP_IDS.trackA, kind: "issue" as const, categoryCodeId: CATEGORY_CODE_IDS.schedule, title: "핵심 인터페이스 일정 지연", description: "외부 연계 규격 확정 지연으로 통합 테스트 일정에 영향이 예상됩니다.", probability: "high" as const, impact: "high" as const, exposureText: "통합 테스트 2주 지연 가능", escalationCodeId: ESCALATION_CODE_IDS.cLevel, status: "in_progress" as const, updatedAt: "2026-07-28T09:00:00.000Z" },
    { id: "40000000-0000-4000-8000-000000000002", displayId: "IR-2026-000002", groupId: GROUP_IDS.trackB, kind: "risk" as const, categoryCodeId: CATEGORY_CODE_IDS.cost, title: "추가 라이선스 비용 발생 가능성", description: "사용자 증가에 따라 상용 라이선스 구간 변경 가능성이 있습니다.", probability: "medium" as const, impact: "high" as const, exposureText: "연간 약 3천만원", escalationCodeId: ESCALATION_CODE_IDS.departmentHead, status: "registered" as const, updatedAt: "2026-07-31T09:00:00.000Z" },
    { id: "40000000-0000-4000-8000-000000000003", displayId: "IR-2026-000003", groupId: GROUP_IDS.common, kind: "risk" as const, categoryCodeId: CATEGORY_CODE_IDS.organization, title: "의사결정 지연 가능성", description: "주요 의사결정권자 일정 중복으로 승인 리드타임 증가가 예상됩니다.", probability: "medium" as const, impact: "medium" as const, exposureText: "승인 일정 3영업일 지연 가능", escalationCodeId: ESCALATION_CODE_IDS.departmentHead, status: "on_hold" as const, updatedAt: "2026-08-01T09:00:00.000Z" },
  ];
  for (const item of itemSeeds) {
    await prisma.item.create({
      data: {
        id: item.id, displayId: item.displayId, projectId: PROJECT_ID, groupId: item.groupId, kind: item.kind,
        categoryCodeId: item.categoryCodeId, title: item.title, description: item.description,
        probability: item.probability, impact: item.impact, exposureText: item.exposureText,
        ownerText: "PMO 관리자", ownerUserId: ADMIN_USER_ID, escalationCodeId: item.escalationCodeId,
        status: item.status, createdBy: ADMIN_USER_ID, createdAt: new Date(item.updatedAt), updatedAt: new Date(item.updatedAt),
      },
    });
    await prisma.itemEvent.create({
      data: { itemId: item.id, eventType: "created", actorId: ADMIN_USER_ID, actorName: "PMO 관리자", body: "초기 데이터 등록", createdAt: new Date(item.updatedAt) },
    });
  }
  await prisma.itemSequence.create({ data: { projectId: PROJECT_ID, value: itemSeeds.length } });

  const week1 = await prisma.week.create({
    data: { id: "81000000-0000-4000-8000-000000000001", projectId: PROJECT_ID, weekKey: "2026-W31", label: "2026년 31주차", startDate: new Date("2026-07-27"), endDate: new Date("2026-08-02") },
  });
  await prisma.week.create({
    data: { id: "81000000-0000-4000-8000-000000000002", projectId: PROJECT_ID, weekKey: "2026-W32", label: "2026년 32주차", startDate: new Date("2026-08-03"), endDate: new Date("2026-08-09") },
  });

  await prisma.weeklyReport.create({
    data: {
      id: "82000000-0000-4000-8000-000000000001", weekId: week1.id, groupId: GROUP_IDS.common,
      achievements: "핵심 기능 요구사항과 화면 흐름을 정리했습니다.", nextPlan: "주간실적 및 인력변동 기능을 구현합니다.",
      issues: "공통코드 운영 기준 확정이 필요합니다.", decisions: "인증은 업무 기능 완료 후 적용합니다.", createdBy: ADMIN_USER_ID,
    },
  });
  await prisma.weeklyProgress.create({
    data: {
      id: "83000000-0000-4000-8000-000000000001", weekId: week1.id, groupId: GROUP_IDS.trackA,
      taskName: "이슈관리 기능 고도화", planDetail: "공통코드 그룹형 전환", planTargetDate: new Date("2026-08-01"),
      actualDetail: "그룹형 관리 및 고밀도 UI 완료", actualDate: new Date("2026-08-01"), progress: 100,
      nextPlan: "주간업무 모듈 구현", nextTargetDate: new Date("2026-08-07"), createdBy: ADMIN_USER_ID,
    },
  });
  await prisma.staffChange.create({
    data: {
      id: "84000000-0000-4000-8000-000000000001", weekId: week1.id, groupId: GROUP_IDS.trackA,
      changeType: "join", currentCount: 4, nextCount: 5, notes: "차주 개발 인력 1명 추가 예정", createdBy: ADMIN_USER_ID,
    },
  });

  console.log("Seed complete.");
  console.log(`Admin login: ${ADMIN_LOGIN_ID} / temp password: ${ADMIN_TEMP_PASSWORD} (첫 로그인 후 반드시 변경)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
