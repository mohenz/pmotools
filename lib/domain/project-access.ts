// 프로젝트 접근 규칙 (2026-09-29, 계정 역할 통일 R-1) — pmotools · 백오피스가 같은 내용을 쓴다(양쪽 파일을 함께 고친다).
//   슈퍼관리자·관리자: 모든 프로젝트에 접근, 프로젝트 안에서도 계정 역할 그대로
//   운영자·사용자: 배정(활성 소속)된 프로젝트에만 접근, 프로젝트 안에서도 계정 역할 그대로
// 프로젝트별 역할(ProjectMember.role)은 더 이상 권한 판단에 쓰지 않는다(이전 역할 이력 참고용으로만 보존).
export type AccountRole = "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "MEMBER";

const ALL_PROJECT_ROLES = new Set<string>(["SUPER_ADMIN", "ADMIN"]);

export function hasAllProjectAccess(role: string | null | undefined): boolean {
  return ALL_PROJECT_ROLES.has(role ?? "");
}

/** 이 프로젝트에서 동작할 역할. 접근할 수 없으면 null. */
export function effectiveProjectRole(accountRole: string | null | undefined, assigned: boolean): AccountRole | null {
  if (!accountRole) return null;
  if (hasAllProjectAccess(accountRole)) return accountRole as AccountRole;
  return assigned ? (accountRole as AccountRole) : null;
}
