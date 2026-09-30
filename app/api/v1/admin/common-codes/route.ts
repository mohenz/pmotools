import { NextRequest, NextResponse } from "next/server";
import { createGlobalCommonCode, listGlobalCommonCodes } from "@/lib/server/common-codes";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const groupId = request.nextUrl.searchParams.get("groupId") ?? undefined;
  return NextResponse.json({ data: await listGlobalCommonCodes(groupId) });
}

export async function POST(request: NextRequest) {
  const { userId } = await getLocalContext();
  try {
    const result = await createGlobalCommonCode(userId, await request.json());
    return NextResponse.json({ data: result.code, requestId: result.requestId }, { status: 201 });
  } catch (error) { return mutationErrorResponse(error); }
}
