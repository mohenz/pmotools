import { NextRequest, NextResponse } from "next/server";
import { createCommonCode, listCommonCodes } from "@/lib/server/common-codes";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET() {
  const { projectId } = await getLocalContext();
  return NextResponse.json({ data: await listCommonCodes(projectId) });
}

export async function POST(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await createCommonCode(projectId, userId, await request.json());
    return NextResponse.json({ data: result.code, requestId: result.requestId }, { status: 201 });
  } catch (error) { return mutationErrorResponse(error); }
}

