import "server-only";

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { COMMON_CODE_GROUP_IDS, DEFAULT_FIRESTORE_DATABASE_ID, DEFAULT_PROJECT_ID as MODEL_PROJECT_ID, DEFAULT_USER_ID as MODEL_USER_ID, FIRESTORE_SEED_CODES } from "@/lib/domain/firestore-model";

export const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || DEFAULT_FIRESTORE_DATABASE_ID;
export const DEFAULT_PROJECT_ID = process.env.DEFAULT_PROJECT_ID || MODEL_PROJECT_ID;
export const DEFAULT_USER_ID = process.env.LOCAL_USER_ID || MODEL_USER_ID;

const globalForFirestore = globalThis as unknown as {
  pmoFirestore?: Firestore;
  pmoSeedPromise?: Promise<void>;
};

function createFirestore() {
  const app = getApps()[0] ?? initializeApp({ credential: applicationDefault() });
  return getFirestore(app, FIRESTORE_DATABASE_ID);
}

export function getDb() {
  globalForFirestore.pmoFirestore ??= createFirestore();
  return globalForFirestore.pmoFirestore;
}

export function projectRef(projectId: string) {
  return getDb().collection("projects").doc(projectId);
}

export function projectCollection(projectId: string, name: string) {
  return projectRef(projectId).collection(name);
}

export function nowIso() {
  return new Date().toISOString();
}

export function dataWithId<T>(id: string, data: DocumentData) {
  return { id, ...data } as T;
}

export function businessDaysSince(value: string) {
  const start = new Date(value);
  const end = new Date();
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);
  let count = 0;
  for (const cursor = new Date(start.getTime() + 86_400_000); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

export async function listDocuments<T>(projectId: string, collectionName: string) {
  await ensureFirestoreSeeded(projectId);
  const snapshot = await projectCollection(projectId, collectionName).get();
  return snapshot.docs.map((document) => dataWithId<T>(document.id, document.data()));
}

export async function getDocument<T>(projectId: string, collectionName: string, id: string) {
  await ensureFirestoreSeeded(projectId);
  const snapshot = await projectCollection(projectId, collectionName).doc(id).get();
  return snapshot.exists ? dataWithId<T>(snapshot.id, snapshot.data()!) : null;
}

export async function writeAuditLog(
  projectId: string,
  actorId: string | null,
  action: string,
  beforeData: Record<string, unknown> | null,
  afterData: Record<string, unknown> | null,
) {
  const id = crypto.randomUUID();
  await projectCollection(projectId, "auditLogs").doc(id).set({
    action,
    actorId,
    actorName: actorId === DEFAULT_USER_ID ? "PMO 관리자" : null,
    beforeData,
    afterData,
    createdAt: nowIso(),
  });
  return id;
}

async function seedFirestore(projectId: string) {
  const db = getDb();
  const project = db.collection("projects").doc(projectId);
  const existing = await project.get();
  if (existing.exists) return;

  const batch = db.batch();
  const createdAt = "2026-08-02T00:00:00.000Z";
  batch.set(project, {
    code: "PMO-DEMO", name: "PMO 통제 프로젝트", openMethod: "phased",
    startDate: "2026-07-01", endDate: "2026-12-31", firstOpenDate: "2026-10-01", secondOpenDate: "2026-12-01", goLiveDate: null,
    customerName: "발주사", vendorName: "수행사", customerPm: "발주사 PM", customerPmoCount: 1,
    vendorPm: "수행사 PM", vendorPmoCount: 1, projectGrade: "B", timezone: "Asia/Seoul", staleBusinessDays: 3,
    createdAt, updatedAt: createdAt,
  });
  batch.set(project.collection("members").doc(DEFAULT_USER_ID), { role: "pmo_admin", name: "PMO 관리자", email: "local.pmo@example.com", isActive: true });
  batch.set(db.collection("profiles").doc(DEFAULT_USER_ID), { name: "PMO 관리자", email: "local.pmo@example.com", department: "PMO", isActive: true });

  const groups = [
    [COMMON_CODE_GROUP_IDS.category, "category", "유형", "이슈·리스크 분류 유형", 1],
    [COMMON_CODE_GROUP_IDS.track, "track", "관련 Track", "프로젝트 수행 영역", 2],
    [COMMON_CODE_GROUP_IDS.escalation, "escalation_level", "에스컬레이션 레벨", "확률×영향 점수별 보고 수준", 3],
  ] as const;
  for (const [id, code, label, description, sortOrder] of groups) {
    batch.set(project.collection("commonCodeGroups").doc(id), { code, label, description, sortOrder, isActive: true, isSystem: true, createdAt, updatedAt: createdAt });
  }
  for (const [id, groupId, groupCode, code, label, sortOrder, minScore] of FIRESTORE_SEED_CODES) {
    batch.set(project.collection("commonCodes").doc(id), { groupId, groupCode, code, label, sortOrder, isActive: true, minScore, createdAt, updatedAt: createdAt });
  }

  const itemSeeds = [
    ["40000000-0000-4000-8000-000000000001", "IR-2026-000001", "30000000-0000-4000-8000-000000000001", "issue", "50000000-0000-4000-8000-000000000001", "핵심 인터페이스 일정 지연", "외부 연계 규격 확정 지연으로 통합 테스트 일정에 영향이 예상됩니다.", "high", "high", "통합 테스트 2주 지연 가능", "60000000-0000-4000-8000-000000000003", "in_progress", "2026-07-28T09:00:00.000Z"],
    ["40000000-0000-4000-8000-000000000002", "IR-2026-000002", "30000000-0000-4000-8000-000000000002", "risk", "50000000-0000-4000-8000-000000000002", "추가 라이선스 비용 발생 가능성", "사용자 증가에 따라 상용 라이선스 구간 변경 가능성이 있습니다.", "medium", "high", "연간 약 3천만원", "60000000-0000-4000-8000-000000000002", "registered", "2026-07-31T09:00:00.000Z"],
    ["40000000-0000-4000-8000-000000000003", "IR-2026-000003", "30000000-0000-4000-8000-000000000005", "risk", "50000000-0000-4000-8000-000000000004", "의사결정 지연 가능성", "주요 의사결정권자 일정 중복으로 승인 리드타임 증가가 예상됩니다.", "medium", "medium", "승인 일정 3영업일 지연 가능", "60000000-0000-4000-8000-000000000002", "on_hold", "2026-08-01T09:00:00.000Z"],
  ] as const;
  for (const [id, displayId, trackCodeId, kind, categoryCodeId, title, description, probability, impact, exposureText, escalationCodeId, status, updatedAt] of itemSeeds) {
    batch.set(project.collection("items").doc(id), { displayId, projectId, trackCodeId, kind, categoryCodeId, title, description, probability, impact, exposureText, ownerText: "PMO 관리자", ownerUserId: DEFAULT_USER_ID, escalationCodeId, status, createdBy: DEFAULT_USER_ID, version: 1, createdAt: updatedAt, updatedAt, resolvedAt: null, archivedAt: null });
    batch.set(project.collection("itemEvents").doc(`${id}-created`), { itemId: id, eventType: "created", actorId: DEFAULT_USER_ID, actorName: "PMO 관리자", body: "초기 데이터 등록", beforeData: null, afterData: null, createdAt: updatedAt });
  }
  batch.set(project.collection("meta").doc("itemSequence"), { value: itemSeeds.length });

  const weeks = [
    ["81000000-0000-4000-8000-000000000001", "2026-W31", "2026년 31주차", "2026-07-27", "2026-08-02"],
    ["81000000-0000-4000-8000-000000000002", "2026-W32", "2026년 32주차", "2026-08-03", "2026-08-09"],
  ] as const;
  for (const [id, weekKey, label, startDate, endDate] of weeks) batch.set(project.collection("weeks").doc(id), { weekKey, label, startDate, endDate, status: "open", createdAt, updatedAt: createdAt });
  batch.set(project.collection("weeklyReports").doc("82000000-0000-4000-8000-000000000001"), { weekId: weeks[0][0], areaCodeId: "30000000-0000-4000-8000-000000000005", achievements: "핵심 기능 요구사항과 화면 흐름을 정리했습니다.", nextPlan: "주간실적 및 인력변동 기능을 구현합니다.", issues: "공통코드 운영 기준 확정이 필요합니다.", decisions: "인증은 업무 기능 완료 후 적용합니다.", notes: "", createdBy: DEFAULT_USER_ID, version: 1, createdAt, updatedAt: createdAt });
  batch.set(project.collection("weeklyProgress").doc("83000000-0000-4000-8000-000000000001"), { weekId: weeks[0][0], areaCodeId: "30000000-0000-4000-8000-000000000001", taskName: "이슈관리 기능 고도화", planDetail: "공통코드 그룹형 전환", planTargetDate: "2026-08-01", actualDetail: "그룹형 관리 및 고밀도 UI 완료", actualDate: "2026-08-01", progress: 100, nextPlan: "주간업무 모듈 구현", nextTargetDate: "2026-08-07", notes: "", createdBy: DEFAULT_USER_ID, version: 1, createdAt, updatedAt: createdAt });
  batch.set(project.collection("staffChanges").doc("84000000-0000-4000-8000-000000000001"), { weekId: weeks[0][0], areaCodeId: "30000000-0000-4000-8000-000000000001", changeType: "join", currentCount: 4, nextCount: 5, notes: "차주 개발 인력 1명 추가 예정", createdBy: DEFAULT_USER_ID, version: 1, createdAt, updatedAt: createdAt });
  await batch.commit();
}

export function ensureFirestoreSeeded(projectId = DEFAULT_PROJECT_ID) {
  if (projectId !== DEFAULT_PROJECT_ID) return seedFirestore(projectId);
  globalForFirestore.pmoSeedPromise ??= seedFirestore(projectId);
  return globalForFirestore.pmoSeedPromise;
}
