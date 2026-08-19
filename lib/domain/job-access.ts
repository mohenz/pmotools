const PM_JOBS = new Set(["PM", "PMO"]);

export function hasPmPmoAccess(jobTitle: string | null | undefined) {
  return PM_JOBS.has(jobTitle?.trim().toUpperCase() ?? "");
}
