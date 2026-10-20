import { NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { hasPmPmoAccess } from "@/lib/domain/job-access";
import { getProjectPortfolio } from "@/lib/server/project-portfolio";
import { mutationErrorResponse } from "@/lib/server/http";

// 프로젝트 포트폴리오 조회(PMO Daily 하위 탭의 새로고침용). PM/PMO 전용, 조회만 한다.
export async function GET() {
  const context = await getLocalContext();
  if (!hasPmPmoAccess(context.jobTitle, context.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "PM/PMO만 사용할 수 있습니다." } }, { status: 403 });
  try { return NextResponse.json({ data: await getProjectPortfolio(context.projectId) }); }
  catch (error) { return mutationErrorResponse(error); }
}
