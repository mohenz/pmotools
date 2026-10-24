// ---------------------------------------------------------------------------
// 결함관리 — 순수 도메인 규칙(설계서: docs/결함관리 프로그램 설계서.md, 2026-10-24 승인).
// 단위테스트(lib/domain/ut.ts)와 독립이다(규칙 1) — 이 파일은 단위테스트 코드를 가져오거나 수정하지 않는다.
// ---------------------------------------------------------------------------

export class DefectRuleError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

// ---------------------------------------------------------------------------
// 결함번호 체번 체계(설계서 3.4): DF-{yyMMdd}-{순번 4자리}
//   순번 범위 배정 — 0001~4999: 단위테스트 결함(단위테스트 프로그램이 지금 방식 그대로 매긴다) · 5000: 예비 · 5001~9999: 결함관리 결함
// ---------------------------------------------------------------------------

export const DEFECT_SEQ_RESERVED = 5000;
export const DEFECT_SEQ_MIN = 5001;
export const DEFECT_SEQ_MAX = 9999;
/** 단위테스트 결함이 쓰는 순번의 상한. 이 값을 넘는 번호는 결함관리 번호다. */
export const UT_DEFECT_SEQ_MAX = 4999;

/** date는 "YYYY-MM-DD"(한국 시간 등록일). 결함관리 순번(5001~9999)만 발급한다. */
export function defectDisplayId(date: string, seq: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new DefectRuleError("INVALID_DATE", "결함 번호의 날짜 형식이 올바르지 않습니다.");
  if (!Number.isInteger(seq) || seq < DEFECT_SEQ_MIN || seq > DEFECT_SEQ_MAX) {
    throw new DefectRuleError("SEQUENCE_EXHAUSTED", `결함관리 결함 번호는 ${DEFECT_SEQ_MIN}~${DEFECT_SEQ_MAX} 범위여야 합니다(오늘 발급 한도 ${DEFECT_SEQ_MAX - DEFECT_SEQ_MIN + 1}건).`);
  }
  return `DF-${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}-${String(seq).padStart(4, "0")}`;
}

export type DefectNumberSource = "DEFECT" | "UNIT_TEST";

/** 번호만 보고 출처를 판별한다 — 순번 5001 이상이면 결함관리, 1~4999이면 단위테스트, 그 외(0000·5000·형식 오류)는 null. */
export function defectNumberSource(displayId: string): DefectNumberSource | null {
  const m = /^DF-\d{6}-(\d{4})$/.exec(displayId);
  if (!m) return null;
  const seq = Number(m[1]);
  if (seq >= DEFECT_SEQ_MIN && seq <= DEFECT_SEQ_MAX) return "DEFECT";
  if (seq >= 1 && seq <= UT_DEFECT_SEQ_MAX) return "UNIT_TEST";
  return null;
}

// ---------------------------------------------------------------------------
// 기본 코드 값(설계서 3.2, 새 프로젝트의 기본 시드) — 관리자가 설정 화면에서 이름 변경·추가·비활성할 수 있다.
// ---------------------------------------------------------------------------

export type DefectStatusClassType = "OPEN" | "DONE" | "CLOSED";
export const DEFECT_STATUS_CLASS_LABEL: Record<DefectStatusClassType, string> = { OPEN: "미조치", DONE: "조치완료", CLOSED: "종결" };

export const DEFECT_GROUP = {
  stage: "defect_test_stage",
  status: "defect_status",
  severity: "defect_severity",
  priority: "defect_priority",
  identification: "defect_identification",
} as const;

export type DefectCodeSeed = { code: string; label: string; statusClass?: DefectStatusClassType; isMajorImpact?: boolean };
export type DefectGroupSeed = { code: string; label: string; description: string; sortOrder: number; codes: DefectCodeSeed[] };

export const DEFECT_CODE_DEFAULTS: DefectGroupSeed[] = [
  { code: DEFECT_GROUP.stage, label: "결함 테스트 단계", description: "결함이 발견된 테스트 단계(프로젝트에 맞게 변경)", sortOrder: 910, codes: [
    { code: "UNIT", label: "단위" }, { code: "INTEGRATION", label: "통합" }, { code: "THIRD_PARTY", label: "3자" }, { code: "OPEN_TEST", label: "오픈" },
  ] },
  { code: DEFECT_GROUP.status, label: "결함 상태", description: "결함 처리 진행 상태(분류: 미조치·조치완료·종결)", sortOrder: 911, codes: [
    { code: "OPEN", label: "접수", statusClass: "OPEN" }, { code: "IN_PROGRESS", label: "조치중", statusClass: "OPEN" }, { code: "REOPENED", label: "재오픈", statusClass: "OPEN" },
    { code: "RESOLVED", label: "조치완료", statusClass: "DONE" }, { code: "STAGING", label: "반영대기", statusClass: "DONE" }, { code: "CLOSED", label: "종결", statusClass: "CLOSED" },
  ] },
  { code: DEFECT_GROUP.severity, label: "결함 심각도", description: "결함 자체의 영향도(조치 상태와 별개)", sortOrder: 912, codes: [
    { code: "CRITICAL", label: "Critical", isMajorImpact: true }, { code: "MAJOR", label: "Major", isMajorImpact: true },
    { code: "MINOR", label: "Minor", isMajorImpact: false }, { code: "TRIVIAL", label: "Trivial", isMajorImpact: false },
  ] },
  { code: DEFECT_GROUP.priority, label: "결함 우선순위", description: "조치 우선순위", sortOrder: 913, codes: [
    { code: "P1", label: "긴급" }, { code: "P2", label: "높음" }, { code: "P3", label: "보통" }, { code: "P4", label: "낮음" },
  ] },
  { code: DEFECT_GROUP.identification, label: "결함식별", description: "결함 여부 판정(기존결함·협의필요 등)", sortOrder: 914, codes: [
    { code: "EXISTING", label: "기존결함" }, { code: "DISCUSS", label: "협의필요" }, { code: "NEW_REQUIREMENT", label: "신규요구사항" }, { code: "NOT_DEFECT", label: "결함아님" },
  ] },
];

/** 시드 계획 — 이미 있는 그룹은 건드리지 않고(관리자가 바꿨을 수 있음) 없는 그룹만 만든다. */
export function planDefectSeed(existingGroupCodes: Iterable<string>): DefectGroupSeed[] {
  const have = new Set(existingGroupCodes);
  return DEFECT_CODE_DEFAULTS.filter((g) => !have.has(g.code));
}

// ---------------------------------------------------------------------------
// 상태 분류·중대 결함(설계서 3.1·3.2·7장)
// ---------------------------------------------------------------------------

export type StatusClassMap = ReadonlyMap<string, DefectStatusClassType>;

/** 상태 코드 id → 분류. 분류가 지정되지 않은 상태는 미조치로 본다(통계에서 빠뜨리지 않기 위함). */
export function statusClassOf(statusCodeId: string, classes: StatusClassMap): DefectStatusClassType {
  return classes.get(statusCodeId) ?? "OPEN";
}

/** "미조치 중대 결함" — 상태 분류가 미조치이고 심각도가 중대로 설정된 결함. */
export function isUnresolvedMajorDefect(input: { statusCodeId: string; severityCodeId: string }, classes: StatusClassMap, majorSeverityIds: ReadonlySet<string>) {
  return statusClassOf(input.statusCodeId, classes) === "OPEN" && majorSeverityIds.has(input.severityCodeId);
}

/** 조치완료율 = (조치완료 + 종결) / 전체. 전체가 0이면 null(표시는 "–"). */
export function resolutionRate(counts: { OPEN: number; DONE: number; CLOSED: number }) {
  const total = counts.OPEN + counts.DONE + counts.CLOSED;
  return total === 0 ? null : (counts.DONE + counts.CLOSED) / total;
}
