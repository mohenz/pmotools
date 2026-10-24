import "server-only";
import ExcelJS from "exceljs";
import { z } from "zod";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { hasFullDefectView } from "@/lib/domain/defect-access";
import { matchScreen, SCREEN_LIMITS, screenPathKey, validateScreenRows, type ScreenEntry, type ScreenRowError, type ScreenRowInput } from "@/lib/domain/defect-screens";
import type { DefectActorCtx } from "@/lib/server/mp/defects/defects";

// ---------------------------------------------------------------------------
// 화면 목록(DM-11, 설계서 5.2) — 조회·검색·단건 등록/수정/비활성·엑셀 일괄 등록. 조회·선택은 구성원 전체, 쓰기는 운영자·PMO·관리자.
// 일괄 등록은 미리보기(저장 안 함) → 같은 파일로 반영(오류가 있으면 반영 거부, 전체 한 트랜잭션).
// ---------------------------------------------------------------------------

const canWrite = (a: DefectActorCtx) => hasFullDefectView({ userId: a.userId, role: a.role, jobTitle: a.jobTitle });
function assertWriter(a: DefectActorCtx) { if (!canWrite(a)) throw new DomainError("FORBIDDEN", "화면 목록은 운영자·PMO·관리자만 변경할 수 있습니다."); }

const toEntry = (s: { id: string; path: string; url: string | null; name: string; isActive: boolean; createdAt: Date }): ScreenEntry => ({ id: s.id, path: s.path, url: s.url, name: s.name, isActive: s.isActive, createdAt: s.createdAt.toISOString() });

export async function listScreens(actor: DefectActorCtx, q = "", includeInactive = false) {
  const term = q.trim();
  const rows = await getPrisma().defectScreen.findMany({
    where: { projectId: actor.projectId, ...(includeInactive ? {} : { isActive: true }), ...(term ? { OR: [{ path: { contains: term, mode: "insensitive" } }, { name: { contains: term, mode: "insensitive" } }, { url: { contains: term, mode: "insensitive" } }] } : {}) },
    orderBy: [{ path: "asc" }], take: 1000,
  });
  return { rows: rows.map(toEntry), canWrite: canWrite(actor) };
}

export async function matchCollectedUrl(actor: DefectActorCtx, url: string) {
  const all = await getPrisma().defectScreen.findMany({ where: { projectId: actor.projectId, isActive: true, url: { not: null } } });
  const hit = matchScreen(url, all.map(toEntry));
  return hit ? { path: hit.path, name: hit.name, url: hit.url } : null;
}

const screenSchema = z.object({
  id: z.string().uuid().optional(),
  path: z.string().trim().min(1, "화면경로는 필수입니다.").max(SCREEN_LIMITS.path),
  url: z.string().trim().max(SCREEN_LIMITS.url).refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "화면 URL은 http 또는 https 주소여야 합니다.").default(""),
  name: z.string().trim().max(SCREEN_LIMITS.name).default(""),
  isActive: z.boolean().default(true),
});

export async function saveScreen(actor: DefectActorCtx, input: unknown) {
  assertWriter(actor);
  const d = screenSchema.parse(input);
  const prisma = getPrisma();
  const pathKey = screenPathKey(d.path);
  const dup = await prisma.defectScreen.findFirst({ where: { projectId: actor.projectId, pathKey, ...(d.id ? { id: { not: d.id } } : {}) }, select: { id: true } });
  if (dup) throw new DomainError("INVALID_STATE", "같은 화면경로가 이미 있습니다.");
  const data = { path: d.path, pathKey, url: d.url || null, name: d.name, isActive: d.isActive };
  let id = d.id;
  if (id) {
    const r = await prisma.defectScreen.updateMany({ where: { id, projectId: actor.projectId }, data: { ...data, updatedBy: actor.userId } });
    if (!r.count) throw new DomainError("NOT_FOUND", "화면 항목을 찾을 수 없습니다.");
  } else {
    id = (await prisma.defectScreen.create({ data: { ...data, projectId: actor.projectId, createdBy: actor.userId } })).id;
  }
  await writeAuditLog(actor.projectId, actor.userId, "DEFECT_SCREEN", "defect_screens", id, null, data);
  return { id };
}

// ---------------------------------------------------------------------------
// 엑셀
// ---------------------------------------------------------------------------

const HEADERS = ["화면경로", "화면 URL", "화면명", "사용 여부"] as const;

export async function buildScreenTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("화면 목록");
  ws.addRow([...HEADERS]);
  ws.addRow(["주문 > 주문 목록", "http://localhost:8080/orders", "주문 목록", "Y"]);
  ws.addRow(["상품 > 상세", "http://localhost:8080/products/*", "상품 상세(패턴: * 사용 가능)", "Y"]);
  ws.getRow(1).font = { bold: true };
  [40, 50, 30, 10].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const notes = wb.addWorksheet("작성 안내");
  ["화면경로: 필수, 500자 이내", "화면 URL: 선택, 1000자 이내, http:// 또는 https:// 로 시작, * 를 와일드카드로 사용 가능", "화면명: 선택, 255자 이내", "사용 여부: Y 또는 N, 비우면 Y", "한도: 파일 5MB, 최대 5,000행. 오류가 하나라도 있으면 전체가 반영되지 않습니다."].forEach((t) => notes.addRow([t]));
  notes.getColumn(1).width = 100;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function exportScreens(actor: DefectActorCtx) {
  const { rows } = await listScreens(actor, "", true);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("화면 목록");
  ws.addRow([...HEADERS]);
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow([r.path, r.url ?? "", r.name, r.isActive ? "Y" : "N"]);
  [40, 50, 30, 10].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const cellText = (v: ExcelJS.CellValue): string => {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text; // 하이퍼링크
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("result" in v) return String(v.result ?? "");
    if (v instanceof Date) return v.toISOString();
  }
  return String(v);
};

async function parseWorkbook(file: File) {
  if (file.size > SCREEN_LIMITS.maxBytes) throw new DomainError("INVALID_CODE", "파일은 5MB 이하만 올릴 수 있습니다.");
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new DomainError("INVALID_CODE", ".xlsx 파일만 올릴 수 있습니다.");
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ArrayBuffer); } catch { throw new DomainError("INVALID_CODE", "엑셀 파일을 읽을 수 없습니다."); }
  const ws = wb.worksheets[0];
  if (!ws) throw new DomainError("INVALID_CODE", "시트가 없습니다.");
  const head = HEADERS.map((_, i) => cellText(ws.getRow(1).getCell(i + 1).value).trim());
  if (head.some((h, i) => h !== HEADERS[i])) throw new DomainError("INVALID_CODE", `첫 행 머리글이 양식과 다릅니다(${HEADERS.join(", ")}). 양식을 내려받아 사용해 주세요.`);
  const rows: ScreenRowInput[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const r = { rowNumber: n, path: cellText(row.getCell(1).value), url: cellText(row.getCell(2).value), name: cellText(row.getCell(3).value), active: cellText(row.getCell(4).value) };
    if (r.path.trim() || r.url.trim() || r.name.trim() || r.active.trim()) rows.push(r);
  });
  if (!rows.length) throw new DomainError("INVALID_CODE", "등록할 행이 없습니다.");
  if (rows.length > SCREEN_LIMITS.maxRows) throw new DomainError("INVALID_CODE", `최대 ${SCREEN_LIMITS.maxRows.toLocaleString()}행까지 올릴 수 있습니다.`);
  return rows;
}

export async function previewScreenImport(actor: DefectActorCtx, file: File) {
  assertWriter(actor);
  const { ok, errors } = validateScreenRows(await parseWorkbook(file));
  const existing = new Set((await getPrisma().defectScreen.findMany({ where: { projectId: actor.projectId, pathKey: { in: ok.map((o) => o.pathKey) } }, select: { pathKey: true } })).map((e) => e.pathKey));
  const preview = ok.map((o) => ({ rowNumber: o.rowNumber, path: o.path, url: o.url, name: o.name, isActive: o.isActive, action: existing.has(o.pathKey) ? "수정" : "등록" }));
  return { total: ok.length + new Set(errors.map((e) => e.rowNumber)).size, insertCount: preview.filter((p) => p.action === "등록").length, updateCount: preview.filter((p) => p.action === "수정").length, errorCount: errors.length, rows: preview.slice(0, 200), errors: errors.slice(0, 500) };
}

export async function commitScreenImport(actor: DefectActorCtx, file: File) {
  assertWriter(actor);
  const { ok, errors } = validateScreenRows(await parseWorkbook(file));
  if (errors.length) throw new DomainError("INVALID_STATE", `오류가 ${errors.length}건 있어 반영하지 않았습니다. 오류 보고서를 확인해 주세요.`);
  const prisma = getPrisma();
  let inserted = 0; let updated = 0;
  await prisma.$transaction(async (tx) => {
    const existing = new Map((await tx.defectScreen.findMany({ where: { projectId: actor.projectId, pathKey: { in: ok.map((o) => o.pathKey) } }, select: { id: true, pathKey: true } })).map((e) => [e.pathKey, e.id]));
    for (const o of ok) {
      const data = { path: o.path, url: o.url, name: o.name, isActive: o.isActive };
      const id = existing.get(o.pathKey);
      if (id) { await tx.defectScreen.update({ where: { id }, data: { ...data, updatedBy: actor.userId } }); updated += 1; }
      else { await tx.defectScreen.create({ data: { ...data, pathKey: o.pathKey, projectId: actor.projectId, createdBy: actor.userId } }); inserted += 1; }
    }
  }, { timeout: 60_000 });
  await writeAuditLog(actor.projectId, actor.userId, "DEFECT_SCREEN_IMPORT", "defect_screens", actor.projectId, null, { inserted, updated, fileName: file.name });
  return { inserted, updated };
}

export async function buildScreenErrorReport(errors: ScreenRowError[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("오류 보고서");
  ws.addRow(["행 번호", "항목", "사유"]);
  ws.getRow(1).font = { bold: true };
  for (const e of errors) ws.addRow([e.rowNumber, e.field, e.message]);
  [10, 16, 60].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** 오류 보고서 내려받기 — 업로드한 파일을 다시 검증한 결과를 엑셀로 돌려준다. */
export async function screenImportErrorReport(actor: DefectActorCtx, file: File) {
  assertWriter(actor);
  return buildScreenErrorReport(validateScreenRows(await parseWorkbook(file)).errors);
}
