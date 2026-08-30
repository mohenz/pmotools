const PM_JOBS = new Set(["PM", "PMO"]);

// 슈퍼관리자는 직무(jobTitle)와 무관하게 PM/PMO 전용 화면(관리업무·이슈관리·PMO Daily)에도 항상 접근할 수 있어야 한다.
export function hasPmPmoAccess(jobTitle: string | null | undefined, role?: string | null) {
  if (role === "SUPER_ADMIN") return true;
  return PM_JOBS.has(jobTitle?.trim().toUpperCase() ?? "");
}
