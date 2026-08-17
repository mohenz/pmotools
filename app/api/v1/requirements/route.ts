import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { createRequirement, listRequirements } from "@/lib/server/requirements";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const { projectId } = await getLocalContext();
  const params = request.nextUrl.searchParams;
  const result = await listRequirements(projectId, {
    q: params.get("q") ?? undefined,
    acceptanceStatus: params.get("acceptanceStatus") ?? undefined,
    page: Number(params.get("page")) || 1,
    pageSize: Number(params.get("pageSize")) || 20,
  });
  return NextResponse.json({ data: result });
}

export async function POST(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  try {
    const requirement = await createRequirement(projectId, userId, await request.json());
    return NextResponse.json({ data: requirement, requestId: requirement.requestId }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
