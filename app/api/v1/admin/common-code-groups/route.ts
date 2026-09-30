import { NextRequest, NextResponse } from "next/server";
import { createGlobalCommonCodeGroup, listGlobalCommonCodeGroups } from "@/lib/server/common-codes";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET() {
  return NextResponse.json({ data: await listGlobalCommonCodeGroups() });
}

export async function POST(request: NextRequest) {
  const { userId } = await getLocalContext();
  try {
    const result = await createGlobalCommonCodeGroup(userId, await request.json());
    return NextResponse.json({ data: result.group, requestId: result.requestId }, { status: 201 });
  } catch (error) { return mutationErrorResponse(error); }
}
