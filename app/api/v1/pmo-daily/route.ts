import { NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { hasPmPmoAccess } from "@/lib/domain/job-access";
import { savePmoDailySnapshot } from "@/lib/server/pmo-daily";
import { mutationErrorResponse } from "@/lib/server/http";

export async function PUT(request: Request) {
  const context = await getLocalContext();
  if (!hasPmPmoAccess(context.jobTitle)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "PM/PMO만 사용할 수 있습니다." } }, { status: 403 });
  try { return NextResponse.json({ data: await savePmoDailySnapshot(context.projectId, context.userId, await request.json()) }); }
  catch (error) { return mutationErrorResponse(error); }
}
