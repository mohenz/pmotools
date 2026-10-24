import { NextRequest, NextResponse } from "next/server";
import { assertMpWritableProject, getMpScope } from "@/lib/server/mp/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { DomainError } from "@/lib/server/errors";
import { assignDefect, createDefect, deleteDefect, getDefect, listDefects, listUnassignedDefects, updateDefect, type DefectActorCtx } from "@/lib/server/mp/defects/defects";
import { ensureDefectCommonCodes, getDefectCodes } from "@/lib/server/mp/defects/common";
import { getDefectStats, listActionRecheck } from "@/lib/server/mp/defects/stats";
import { getCaseEntry, searchCases } from "@/lib/server/mp/defects/lookup";
import { addDefectEvidence, openDefectEvidence } from "@/lib/server/mp/defects/evidence";
import { buildDefectWorkbook } from "@/lib/server/mp/defects/export";
import { getDefectSettings, saveTargetSite, setSeverityMajor } from "@/lib/server/mp/defects/settings";
import { buildScreenTemplate, commitScreenImport, exportScreens, listScreens, matchCollectedUrl, previewScreenImport, saveScreen, screenImportErrorReport } from "@/lib/server/mp/defects/screens";

// ---------------------------------------------------------------------------
// 결함관리 API(/api/v1/mp/defects/*) — 선택 프로젝트 기준. 쓰기는 하위 프로젝트에서만. 권한 세부 판정은 서버 모듈이 한다.
// 단위테스트 모듈과 같은 경로표 방식. 쓰기 요청은 Origin이 같은 사이트일 때만 받는다(요청 위조 방지).
// ---------------------------------------------------------------------------

type Ctx = { params: Promise<{ path: string[] }> };
const ok = (data: unknown, status = 200) => NextResponse.json({ data }, { status });
const body = (request: NextRequest) => request.json().catch(() => ({}));
const notFound = () => new DomainError("NOT_FOUND", "요청한 경로를 찾을 수 없습니다.");
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const attachment = (buffer: Buffer, name: string) => new NextResponse(new Uint8Array(buffer), { headers: { "content-type": XLSX, "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`, "cache-control": "private, no-store" } });

async function readActor(): Promise<DefectActorCtx> {
  const c = (await getMpScope()).context;
  return { projectId: c.projectId, userId: c.userId, role: c.role, jobTitle: c.jobTitle };
}
async function writeActor(request: NextRequest): Promise<DefectActorCtx> {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) throw new DomainError("FORBIDDEN", "허용되지 않은 요청 출처입니다.");
  const c = await assertMpWritableProject();
  return { projectId: c.projectId, userId: c.userId, role: c.role, jobTitle: c.jobTitle };
}
const filesOf = (form: FormData, key = "files") => form.getAll(key).filter((v): v is File => typeof v !== "string" && v.size > 0);
const fileOf = (form: FormData) => {
  const f = form.get("file");
  if (!f || typeof f === "string") throw new DomainError("INVALID_CODE", "파일을 선택해 주세요.");
  return f;
};

export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const [a, id, b] = (await params).path;
    const actor = await readActor();
    const sp = request.nextUrl.searchParams;
    const filters = {
      q: sp.get("q") ?? undefined, stageId: sp.get("stageId") ?? undefined, statusId: sp.get("statusId") ?? undefined, statusClass: sp.get("statusClass") ?? undefined,
      severityId: sp.get("severityId") ?? undefined, priorityId: sp.get("priorityId") ?? undefined, assignee: sp.get("assignee") ?? undefined, creator: sp.get("creator") ?? undefined,
      unassigned: sp.get("unassigned") === "1", from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined,
      page: Number(sp.get("page")) || undefined, pageSize: Number(sp.get("pageSize")) || undefined,
    };
    if (a === "codes") { await ensureDefectCommonCodes(actor.projectId); return ok(await getDefectCodes(actor.projectId)); }
    if (a === "unassigned") return ok(await listUnassignedDefects(actor));
    if (a === "list" || !a) return ok(await listDefects(actor, filters));
    if (a === "export") return attachment(await buildDefectWorkbook((await listDefects(actor, { ...filters, page: 1, pageSize: 200 })).rows), "결함목록.xlsx");
    if (a === "items" && id) return ok(await getDefect(actor, id));
    if (a === "stats") return ok(await getDefectStats(actor, { stageId: filters.stageId, from: filters.from, to: filters.to, includeUt: sp.get("includeUt") !== "0" }));
    if (a === "action-recheck") return ok(await listActionRecheck(actor));
    if (a === "evidences" && id) {
      const file = await openDefectEvidence(actor, id);
      return new NextResponse(new Uint8Array(file.bytes), { headers: { "content-type": file.mimeType, "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
    }
    if (a === "lookup" && id === "cases") return ok(b ? await getCaseEntry(actor.projectId, b) : await searchCases(actor.projectId, sp.get("q") ?? ""));
    if (a === "settings") return ok(await getDefectSettings(actor));
    if (a === "screens" && !id) return ok(await listScreens(actor, sp.get("q") ?? "", sp.get("all") === "1"));
    if (a === "screens" && id === "template") return attachment(await buildScreenTemplate(), "화면목록_양식.xlsx");
    if (a === "screens" && id === "export") return attachment(await exportScreens(actor), "화면목록.xlsx");
    if (a === "screens" && id === "match") return ok(await matchCollectedUrl(actor, sp.get("url") ?? ""));
    throw notFound();
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const [a, id, b, c] = (await params).path;
    const actor = await writeActor(request);
    if (a === "items" && !id) {
      // JSON 또는 멀티파트(payload=JSON 문자열 + files). 증적은 결함 저장 뒤에 올린다.
      if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
        const form = await request.formData();
        const created = await createDefect(actor, JSON.parse(String(form.get("payload") ?? "{}")));
        const files = filesOf(form);
        let evidenceError: string | null = null;
        if (files.length) { try { await addDefectEvidence(actor, created.id, files); } catch (e) { evidenceError = e instanceof Error ? e.message : "증적을 저장하지 못했습니다."; } }
        return ok({ ...created, evidenceError }, 201);
      }
      return ok(await createDefect(actor, await body(request)), 201);
    }
    if (a === "items" && id && b === "assign") return ok(await assignDefect(actor, id, await body(request)));
    if (a === "items" && id && b === "evidence") return ok(await addDefectEvidence(actor, id, filesOf(await request.formData())));
    if (a === "settings" && id === "severity") return ok(await setSeverityMajor(actor, await body(request)));
    if (a === "settings" && id === "sites") return ok(await saveTargetSite(actor, await body(request)));
    if (a === "screens" && !id) return ok(await saveScreen(actor, await body(request)));
    if (a === "screens" && id === "import" && b === "preview") return ok(await previewScreenImport(actor, fileOf(await request.formData())));
    if (a === "screens" && id === "import" && b === "commit") return ok(await commitScreenImport(actor, fileOf(await request.formData())));
    if (a === "screens" && id === "import" && b === "errors") return attachment(await screenImportErrorReport(actor, fileOf(await request.formData())), "화면목록_오류보고서.xlsx");
    void c;
    throw notFound();
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const [a, id] = (await params).path;
    const actor = await writeActor(request);
    if (a === "items" && id) return ok(await updateDefect(actor, id, await body(request)));
    throw notFound();
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const [a, id] = (await params).path;
    const actor = await writeActor(request);
    if (a === "items" && id) return ok(await deleteDefect(actor, id));
    throw notFound();
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
