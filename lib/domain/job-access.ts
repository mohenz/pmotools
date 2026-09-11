const PM_JOBS = new Set(["PM", "PMO"]);

// 슈퍼관리자는 직무(jobTitle)와 무관하게 PM/PMO 전용 화면(관리업무·이슈관리·PMO Daily)에도 항상 접근할 수 있어야 한다.
export function hasPmPmoAccess(jobTitle: string | null | undefined, role?: string | null) {
  if (role === "SUPER_ADMIN") return true;
  return PM_JOBS.has(jobTitle?.trim().toUpperCase() ?? "");
}

const WBS_UNRESTRICTED_ROLES = new Set(["ADMIN", "OPERATOR", "SUPER_ADMIN"]);

// 관리자·운영자를 제외한 일반 사용자(MEMBER)는 프로젝트 전체 WBS가 아니라 본인이 담당(ownerUserId)인 항목만
// 조회할 수 있다 — 검색·목록·상세·통계 등 WBS 관련 모든 진입 경로가 이 기준을 공유한다(2026-09-10 사용자 요청).
export function canViewAllWbs(role: string | null | undefined) {
  return WBS_UNRESTRICTED_ROLES.has(role ?? "");
}
