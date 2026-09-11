import { NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { hasPmPmoAccess } from "@/lib/domain/job-access";
import { archivePmoDelayedTask, updatePmoDelayedTask } from "@/lib/server/pmo-daily";
import { mutationErrorResponse } from "@/lib/server/http";

async function contextOrResponse() {
  const context = await getLocalContext();
  return hasPmPmoAccess(context.jobTitle, context.role) ? context : null;
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await contextOrResponse(); if (!context) return NextResponse.json({ error: { code: "FORBIDDEN", message: "PM/PMO만 사용할 수 있습니다." } }, { status: 403 });
  try { return NextResponse.json({ data: await updatePmoDelayedTask(context.projectId, context.userId, (await params).id, await request.json()) }); } catch (error) { return mutationErrorResponse(error); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await contextOrResponse(); if (!context) return NextResponse.json({ error: { code: "FORBIDDEN", message: "PM/PMO만 사용할 수 있습니다." } }, { status: 403 });
  try { return NextResponse.json({ data: await archivePmoDelayedTask(context.projectId, context.userId, (await params).id, await request.json()) }); } catch (error) { return mutationErrorResponse(error); }
}
