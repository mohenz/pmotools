import "server-only";
import { z } from "zod";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";

export type ProjectInformation = { id: string; code: string; name: string; openMethod: "phased" | "big_bang"; startDate: string | null; endDate: string | null; firstOpenDate: string | null; secondOpenDate: string | null; goLiveDate: string | null; durationMonths: number; durationDays: number; customerName: string; vendorName: string; customerPm: string; customerPmoCount: number; vendorPm: string; vendorPmoCount: number; projectGrade: "A" | "B" | "C"; timezone: string; staleBusinessDays: number };
const schema = z.object({ name: z.string().trim().min(1).max(150), openMethod: z.enum(["phased", "big_bang"]), startDate: z.string().date(), endDate: z.string().date(), firstOpenDate: z.string().date().nullable(), secondOpenDate: z.string().date().nullable(), goLiveDate: z.string().date().nullable(), customerName: z.string().trim().min(1).max(150), vendorName: z.string().trim().min(1).max(150), customerPm: z.string().trim().min(1).max(100), customerPmoCount: z.number().int().min(0).max(999), vendorPm: z.string().trim().min(1).max(100), vendorPmoCount: z.number().int().min(0).max(999), projectGrade: z.enum(["A", "B", "C"]), timezone: z.string().trim().min(1).max(50), staleBusinessDays: z.number().int().min(1).max(30) }).superRefine((d, ctx) => {
  if (d.endDate < d.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "종료일은 시작일 이후여야 합니다." });
  const inPeriod = (date: string | null) => date !== null && date >= d.startDate && date <= d.endDate;
  if (d.openMethod === "phased") {
    if (!d.firstOpenDate) ctx.addIssue({ code: "custom", path: ["firstOpenDate"], message: "1차 오픈일을 입력해 주세요." });
    else if (!inPeriod(d.firstOpenDate)) ctx.addIssue({ code: "custom", path: ["firstOpenDate"], message: "1차 오픈일은 프로젝트 기간 내여야 합니다." });
    if (!d.secondOpenDate) ctx.addIssue({ code: "custom", path: ["secondOpenDate"], message: "2차 오픈일을 입력해 주세요." });
    else if (!inPeriod(d.secondOpenDate) || Boolean(d.firstOpenDate && d.secondOpenDate < d.firstOpenDate)) ctx.addIssue({ code: "custom", path: ["secondOpenDate"], message: "2차 오픈일은 1차 오픈 이후 프로젝트 기간 내여야 합니다." });
  } else if (!d.goLiveDate) ctx.addIssue({ code: "custom", path: ["goLiveDate"], message: "오픈일을 입력해 주세요." });
  else if (!inPeriod(d.goLiveDate)) ctx.addIssue({ code: "custom", path: ["goLiveDate"], message: "오픈일은 프로젝트 기간 내여야 합니다." });
});

function duration(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) return { durationMonths: 0, durationDays: 0 };
  const start = new Date(`${startDate}T00:00:00Z`), end = new Date(`${endDate}T00:00:00Z`);
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  const anchor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, start.getUTCDate()));
  if (anchor > end) { months -= 1; anchor.setUTCMonth(anchor.getUTCMonth() - 1); }
  return { durationMonths: months, durationDays: Math.max(0, Math.round((end.getTime() - anchor.getTime()) / 86_400_000)) };
}
function dateStr(value: Date | null) { return value ? value.toISOString().slice(0, 10) : null; }

export async function getProjectInformation(projectId: string): Promise<ProjectInformation> {
  const project = await getPrisma().project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found.");
  const startDate = dateStr(project.startDate), endDate = dateStr(project.endDate);
  return {
    id: project.id, code: project.code, name: project.name, openMethod: project.openMethod, startDate, endDate,
    firstOpenDate: dateStr(project.firstOpenDate), secondOpenDate: dateStr(project.secondOpenDate), goLiveDate: dateStr(project.goLiveDate),
    ...duration(startDate, endDate),
    customerName: project.customerName, vendorName: project.vendorName, customerPm: project.customerPm, customerPmoCount: project.customerPmoCount,
    vendorPm: project.vendorPm, vendorPmoCount: project.vendorPmoCount, projectGrade: project.projectGrade, timezone: project.timezone, staleBusinessDays: project.staleBusinessDays,
  };
}

export async function updateProjectInformation(projectId: string, input: unknown) {
  const data = schema.parse(input);
  const prisma = getPrisma();
  const before = await prisma.project.findUnique({ where: { id: projectId } });
  if (!before) throw new Error("Project not found.");
  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      name: data.name, openMethod: data.openMethod, startDate: new Date(data.startDate), endDate: new Date(data.endDate),
      firstOpenDate: data.openMethod === "phased" ? new Date(data.firstOpenDate!) : null,
      secondOpenDate: data.openMethod === "phased" ? new Date(data.secondOpenDate!) : null,
      goLiveDate: data.openMethod === "big_bang" ? new Date(data.goLiveDate!) : null,
      customerName: data.customerName, vendorName: data.vendorName, customerPm: data.customerPm, customerPmoCount: data.customerPmoCount,
      vendorPm: data.vendorPm, vendorPmoCount: data.vendorPmoCount, projectGrade: data.projectGrade, timezone: data.timezone, staleBusinessDays: data.staleBusinessDays,
    },
  });
  await writeAuditLog(projectId, null, "PROJECT_UPDATE", "projects", projectId, before, updated);
  return getProjectInformation(updated.id);
}
