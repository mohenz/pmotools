import { NextRequest, NextResponse } from "next/server";
import { assertMpWritableProject, getMpScope } from "@/lib/server/mp/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { DomainError } from "@/lib/server/errors";
import type { UtActor } from "@/lib/server/mp/ut/common";
import {
  archiveUtScenario, createUtCase, createUtScenario, decideUtScenarioReview, getPlReference, getUtFormOptions, getUtScenarioDetail, listUtReviewInbox,
  listUtScenarios, listUtWbsLeaves, reassignUtScenarioPl, requestUtScenarioReview, setUtCaseActive, updateUtCase, updateUtScenario,
} from "@/lib/server/mp/ut/scenarios";
import { decideUtApproval, listMyUtExecutionTargets, listUtApprovalInbox, openUtEvidence, registerUtExecution } from "@/lib/server/mp/ut/executions";
import { fixUtDefect, listUtDefectActions, listUtRunRows, registerUtDefect, updateUtDefect, verifyUtDefect } from "@/lib/server/mp/ut/defects";
import { cancelUtMilestone, confirmUtDevComplete, declareUtDevComplete, getUtSettings, listUtMilestones, recordUtComplete, saveUtSettings, setUtLock } from "@/lib/server/mp/ut/milestones";
import { buildUtRunWorkbook, buildUtSheetWorkbook } from "@/lib/server/mp/ut/export";
import { listUtCaseSheet } from "@/lib/server/mp/ut/grid";

// ---------------------------------------------------------------------------
// 단위테스트 API(/api/v1/mp/ut/*) — 다중 프로젝트(MP) 선택 프로젝트 기준. 쓰기는 하위 프로젝트에서만(assertMpWritableProject).
// 경로표 하나로 분기해 권한·오류 처리를 한곳에 둔다. 권한 세부 판정은 서버 모듈이 한다.
// ---------------------------------------------------------------------------

type Ctx = { params: Promise<{ path: string[] }> };
const ok = (data: unknown, status = 200) => NextResponse.json({ data }, { status });

async function readScope() {
  const scope = await getMpScope();
  const actor: UtActor = { projectId: scope.context.projectId, userId: scope.context.userId, role: scope.context.role, jobTitle: scope.context.jobTitle };
  return { projectIds: scope.projectIds, actor };
}
async function writeActor(): Promise<UtActor> {
  const c = await assertMpWritableProject();
  return { projectId: c.projectId, userId: c.userId, role: c.role, jobTitle: c.jobTitle };
}
const body = (request: NextRequest) => request.json().catch(() => ({}));

export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const path = (await params).path;
    const { projectIds, actor } = await readScope();
    const sp = request.nextUrl.searchParams;
    const [a, id, b] = path;
    if (a === "options") return ok({ ...(await getUtFormOptions(actor.projectId)), wbsLeaves: await listUtWbsLeaves(actor.projectId), plReference: await getPlReference(actor.projectId, actor.userId) });
    if (a === "scenarios" && !id) return ok(await listUtScenarios(projectIds, { q: sp.get("q") ?? undefined, status: sp.get("status") ?? undefined, wbsItemId: sp.get("wbsItemId") ?? undefined, groupId: sp.get("groupId") ?? undefined, mine: sp.get("mine") ?? undefined, userId: actor.userId }));
    if (a === "scenarios" && id && !b) return ok(await getUtScenarioDetail(projectIds, id, actor));
    if (a === "inbox") {
      const [targets, reviews, qc, pl] = await Promise.all([listMyUtExecutionTargets(projectIds, actor.userId), listUtReviewInbox(projectIds, actor.userId), listUtApprovalInbox(projectIds, actor.userId, "QC"), listUtApprovalInbox(projectIds, actor.userId, "PL")]);
      return ok({ targets, reviews, qc, pl });
    }
    if (a === "evidences" && id) {
      const file = await openUtEvidence(projectIds, actor.userId, id);
      return new NextResponse(new Uint8Array(file.bytes), { headers: { "content-type": file.mimeType, "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`, "cache-control": "private, no-store" } });
    }
    if (a === "runs" && !id) {
      const rows = await listUtRunRows(projectIds, actor, { q: sp.get("q") ?? undefined, defectOnly: sp.get("defectOnly") === "1" || sp.get("defect") === "any", openOnly: sp.get("openOnly") === "1" || sp.get("defect") === "open", scenarioId: sp.get("scenarioId") ?? undefined });
      if (sp.get("format") === "xlsx") {
        const buffer = await buildUtRunWorkbook(rows);
        return new NextResponse(new Uint8Array(buffer), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent("단위테스트_수행결함관리.xlsx")}` } });
      }
      return ok(rows);
    }
    if (a === "sheet") {
      const rows = await listUtCaseSheet(actor.projectId, actor, { wbs: sp.get("wbs") || undefined, q: sp.get("q") || undefined, verdict: sp.get("verdict") || undefined, todo: sp.get("todo") || undefined });
      const buffer = await buildUtSheetWorkbook(rows);
      return new NextResponse(new Uint8Array(buffer), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent("단위테스트_목록.xlsx")}` } });
    }
    if (a === "defects" && id && b === "actions") return ok(await listUtDefectActions(projectIds, id));
    if (a === "milestones") return ok(await listUtMilestones(actor.projectId, actor));
    if (a === "settings") return ok(await getUtSettings(actor.projectId));
    throw new DomainError("NOT_FOUND", "요청한 경로가 없습니다.");
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const [a, id, b] = (await params).path;
    const actor = await writeActor();
    if (a === "scenarios" && !id) return ok(await createUtScenario(actor, await body(request)), 201);
    if (a === "scenarios" && id && b === "cases") return ok(await createUtCase(actor, id, await body(request)), 201);
    if (a === "scenarios" && id && b === "review") return ok(await requestUtScenarioReview(actor, id));
    if (a === "scenarios" && id && b === "decision") return ok(await decideUtScenarioReview(actor, id, await body(request)));
    if (a === "cases" && id && b === "executions") {
      const form = await request.formData();
      const files = form.getAll("evidence").filter((f): f is File => typeof f !== "string" && f.size > 0);
      const fields = { verdict: form.get("verdict"), executedOn: form.get("executedOn") || undefined, actualResult: form.get("actualResult") ?? "", naReason: form.get("naReason") ?? "", envCodeId: form.get("envCodeId") || null };
      return ok(await registerUtExecution(actor, id, fields, files), 201);
    }
    if (a === "executions" && id && b === "approval") return ok(await decideUtApproval(actor, id, await body(request)));
    if (a === "executions" && id && b === "defects") return ok(await registerUtDefect(actor, id, await body(request)), 201);
    if (a === "defects" && id && b === "fix") return ok(await fixUtDefect(actor, id, await body(request)));
    if (a === "defects" && id && b === "verify") return ok(await verifyUtDefect(actor, id, await body(request)));
    if (a === "milestones" && id && b === "declare") return ok(await declareUtDevComplete(actor, id, await body(request)));
    if (a === "milestones" && id && b === "confirm") return ok(await confirmUtDevComplete(actor, id, await body(request)));
    if (a === "milestones" && id && b === "ut") return ok(await recordUtComplete(actor, id, await body(request)));
    if (a === "milestones" && id && b === "cancel") return ok(await cancelUtMilestone(actor, id, await body(request)));
    if (a === "settings" && id === "lock") return ok(await setUtLock(actor, await body(request)));
    throw new DomainError("NOT_FOUND", "요청한 경로가 없습니다.");
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const [a, id] = (await params).path;
    const actor = await writeActor();
    if (a === "scenarios" && id) return ok(await updateUtScenario(actor, id, await body(request)));
    if (a === "cases" && id) return ok(await updateUtCase(actor, id, await body(request)));
    if (a === "defects" && id) return ok(await updateUtDefect(actor, id, await body(request)));
    throw new DomainError("NOT_FOUND", "요청한 경로가 없습니다.");
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const [a, id, b] = (await params).path;
    const actor = await writeActor();
    if (a === "scenarios" && id && b === "pl") return ok(await reassignUtScenarioPl(actor, id, await body(request)));
    if (a === "cases" && id && b === "active") return ok(await setUtCaseActive(actor, id, Boolean((await body(request)).isActive)));
    if (a === "settings" && !id) return ok(await saveUtSettings(actor, await body(request)));
    throw new DomainError("NOT_FOUND", "요청한 경로가 없습니다.");
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const [a, id] = (await params).path;
    const actor = await writeActor();
    if (a === "scenarios" && id) return ok(await archiveUtScenario(actor, id));
    throw new DomainError("NOT_FOUND", "요청한 경로가 없습니다.");
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
