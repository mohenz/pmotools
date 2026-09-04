import { config } from "dotenv";
config({ path: ".env", quiet: true });
config({ path: ".env.local", override: false, quiet: true });

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
const ISSUE_TYPE_GROUP_ID = "72000000-0000-4000-8000-000000000001";
const REPORT_LINE_GROUP_ID = "72000000-0000-4000-8000-000000000002";

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

const ISSUE_TYPE_CODE_IDS = {
  scope: "52000000-0000-4000-8000-000000000001",
  schedule: "52000000-0000-4000-8000-000000000002",
  resource: "52000000-0000-4000-8000-000000000003",
  quality: "52000000-0000-4000-8000-000000000004",
  communication: "52000000-0000-4000-8000-000000000005",
} as const;

const REPORT_LINE_CODE_IDS = {
  teamLead: "62000000-0000-4000-8000-000000000001",
  divisionHead: "62000000-0000-4000-8000-000000000002",
  ceo: "62000000-0000-4000-8000-000000000003",
  clientPmo: "62000000-0000-4000-8000-000000000004",
  clientTeamLead: "62000000-0000-4000-8000-000000000005",
  clientExecutive: "62000000-0000-4000-8000-000000000006",
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
      jobTitle: "PMO",
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
  await prisma.commonCodeGroup.create({
    data: { id: ISSUE_TYPE_GROUP_ID, projectId: PROJECT_ID, code: "issue_type", label: "이슈구분", description: "이슈관리 이슈구분 공통코드", sortOrder: 4, isSystem: true },
  });
  await prisma.commonCodeGroup.create({
    data: { id: REPORT_LINE_GROUP_ID, projectId: PROJECT_ID, code: "report_line", label: "보고라인", description: "이슈관리 에스컬레이션 보고라인 공통코드", sortOrder: 5, isSystem: true },
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
      { id: ISSUE_TYPE_CODE_IDS.scope, projectId: PROJECT_ID, groupId: ISSUE_TYPE_GROUP_ID, groupCode: "issue_type", code: "scope", label: "범위", sortOrder: 1 },
      { id: ISSUE_TYPE_CODE_IDS.schedule, projectId: PROJECT_ID, groupId: ISSUE_TYPE_GROUP_ID, groupCode: "issue_type", code: "schedule", label: "일정", sortOrder: 2 },
      { id: ISSUE_TYPE_CODE_IDS.resource, projectId: PROJECT_ID, groupId: ISSUE_TYPE_GROUP_ID, groupCode: "issue_type", code: "resource", label: "자원", sortOrder: 3 },
      { id: ISSUE_TYPE_CODE_IDS.quality, projectId: PROJECT_ID, groupId: ISSUE_TYPE_GROUP_ID, groupCode: "issue_type", code: "quality", label: "품질", sortOrder: 4 },
      { id: ISSUE_TYPE_CODE_IDS.communication, projectId: PROJECT_ID, groupId: ISSUE_TYPE_GROUP_ID, groupCode: "issue_type", code: "communication", label: "소통", sortOrder: 5 },
      { id: REPORT_LINE_CODE_IDS.teamLead, projectId: PROJECT_ID, groupId: REPORT_LINE_GROUP_ID, groupCode: "report_line", code: "team_lead", label: "팀장", sortOrder: 1 },
      { id: REPORT_LINE_CODE_IDS.divisionHead, projectId: PROJECT_ID, groupId: REPORT_LINE_GROUP_ID, groupCode: "report_line", code: "division_head", label: "사업부장", sortOrder: 2 },
      { id: REPORT_LINE_CODE_IDS.ceo, projectId: PROJECT_ID, groupId: REPORT_LINE_GROUP_ID, groupCode: "report_line", code: "ceo", label: "대표이사", sortOrder: 3 },
      { id: REPORT_LINE_CODE_IDS.clientPmo, projectId: PROJECT_ID, groupId: REPORT_LINE_GROUP_ID, groupCode: "report_line", code: "client_pmo", label: "고객사PMO", sortOrder: 4 },
      { id: REPORT_LINE_CODE_IDS.clientTeamLead, projectId: PROJECT_ID, groupId: REPORT_LINE_GROUP_ID, groupCode: "report_line", code: "client_team_lead", label: "고객사팀장", sortOrder: 5 },
      { id: REPORT_LINE_CODE_IDS.clientExecutive, projectId: PROJECT_ID, groupId: REPORT_LINE_GROUP_ID, groupCode: "report_line", code: "client_executive", label: "고객사임원", sortOrder: 6 },
    ],
  });

  const issueSeeds = [
    {
      id: "40000000-0000-4000-8000-000000000001", displayId: "ISU-0001", seq: 1, categoryCodeId: ISSUE_TYPE_CODE_IDS.schedule, title: "핵심 인터페이스 일정 지연", description: "외부 연계 규격 확정 지연으로 통합 테스트 일정에 영향이 예상됩니다.", importance: "high" as const, priority: "high" as const, occurredAt: "2026-07-28", dueAt: "2026-08-15", escalated: true, reportLineCodeIds: [REPORT_LINE_CODE_IDS.divisionHead, REPORT_LINE_CODE_IDS.clientPmo], remark: "",
      progress: [
        { entryDate: "2026-07-28", status: "OPEN" as const, responseContent: "외부 연계 규격 확정 지연 이슈를 등록했습니다." },
        { entryDate: "2026-07-30", status: "IN_PROGRESS" as const, responseContent: "연계사 1차 협의를 진행했습니다." },
        { entryDate: "2026-08-01", status: "IN_PROGRESS" as const, responseContent: "외부 연계사와 규격 확정 일정을 조율 중입니다. 8/15까지 확정 예정." },
      ],
    },
    {
      id: "40000000-0000-4000-8000-000000000002", displayId: "ISU-0002", seq: 2, categoryCodeId: ISSUE_TYPE_CODE_IDS.resource, title: "추가 라이선스 비용 발생 가능성", description: "사용자 증가에 따라 상용 라이선스 구간 변경 가능성이 있습니다.", importance: "medium" as const, priority: "high" as const, occurredAt: "2026-07-31", dueAt: null, escalated: false, reportLineCodeIds: [] as string[], remark: "연간 약 3천만원 추가 소요 예상",
      progress: [{ entryDate: "2026-07-31", status: "OPEN" as const, responseContent: "라이선스 비용 발생 가능성을 등록했습니다." }],
    },
    {
      id: "40000000-0000-4000-8000-000000000003", displayId: "ISU-0003", seq: 3, categoryCodeId: ISSUE_TYPE_CODE_IDS.communication, title: "의사결정 지연", description: "주요 의사결정권자 일정 중복으로 승인 리드타임 증가가 예상됩니다.", importance: "medium" as const, priority: "medium" as const, occurredAt: "2026-08-01", dueAt: "2026-08-10", escalated: false, reportLineCodeIds: [] as string[], remark: "",
      progress: [
        { entryDate: "2026-08-01", status: "OPEN" as const, responseContent: "의사결정 지연 이슈를 등록했습니다." },
        { entryDate: "2026-08-05", status: "IN_PROGRESS" as const, responseContent: "주간 정기회의에서 우선 안건으로 상정했습니다." },
        { entryDate: "2026-08-08", status: "CLOSED" as const, responseContent: "의사결정이 완료되어 종결했습니다." },
      ],
    },
  ];
  for (const issue of issueSeeds) {
    const latest = issue.progress[issue.progress.length - 1];
    await prisma.issue.create({
      data: {
        id: issue.id, displayId: issue.displayId, seq: issue.seq, projectId: PROJECT_ID,
        categoryCodeId: issue.categoryCodeId, title: issue.title, description: issue.description,
        importance: issue.importance, priority: issue.priority, occurredAt: new Date(issue.occurredAt), dueAt: issue.dueAt ? new Date(issue.dueAt) : null,
        ownerUserId: ADMIN_USER_ID, ownerName: "PMO 관리자", responseContent: latest.responseContent,
        escalated: issue.escalated, remark: issue.remark,
        status: latest.status, createdBy: ADMIN_USER_ID, lastModifiedBy: ADMIN_USER_ID, lastModifiedByName: "PMO 관리자",
        createdAt: new Date(issue.occurredAt), updatedAt: new Date(latest.entryDate),
        closedAt: latest.status === "CLOSED" ? new Date(latest.entryDate) : null,
      },
    });
    if (issue.reportLineCodeIds.length) {
      await prisma.issueReportLine.createMany({ data: issue.reportLineCodeIds.map((reportLineCodeId) => ({ issueId: issue.id, reportLineCodeId })) });
    }
    for (const entry of issue.progress) {
      const progress = await prisma.issueProgress.create({
        data: {
          issueId: issue.id, entryDate: new Date(entry.entryDate), status: entry.status,
          categoryCodeId: issue.categoryCodeId, title: issue.title, description: issue.description,
          importance: issue.importance, priority: issue.priority, dueAt: issue.dueAt ? new Date(issue.dueAt) : null,
          ownerUserId: ADMIN_USER_ID, ownerName: "PMO 관리자", responseContent: entry.responseContent,
          escalated: issue.escalated, remark: issue.remark, actorId: ADMIN_USER_ID, actorName: "PMO 관리자",
        },
      });
      if (issue.reportLineCodeIds.length) {
        await prisma.issueProgressReportLine.createMany({ data: issue.reportLineCodeIds.map((reportLineCodeId) => ({ progressId: progress.id, reportLineCodeId })) });
      }
    }
  }
  await prisma.issueSequence.create({ data: { projectId: PROJECT_ID, value: issueSeeds.length } });

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
