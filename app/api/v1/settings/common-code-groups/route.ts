import { NextRequest, NextResponse } from "next/server";
import { createCommonCodeGroup, listCommonCodeGroups } from "@/lib/server/common-codes";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET() {
  const { projectId } = await getLocalContext();
  return NextResponse.json({ data: await listCommonCodeGroups(projectId) });
}

export async function POST(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await createCommonCodeGroup(projectId, userId, await request.json());
    return NextResponse.json({ data: result.group, requestId: result.requestId }, { status: 201 });
  } catch (error) { return mutationErrorResponse(error); }
}
