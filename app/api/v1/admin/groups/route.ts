import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { createGroup, listGroups } from "@/lib/server/admin";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const { projectId } = await getLocalContext();
  const type = request.nextUrl.searchParams.get("type");
  const groupType = type === "WORK_MODULE" || type === "COMPANY" ? type : undefined;
  return NextResponse.json({ data: await listGroups(projectId, groupType) });
}

export async function POST(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  try {
    const group = await createGroup(projectId, userId, await request.json());
    return NextResponse.json({ data: group }, { status: 201 });
  } catch (error) { return mutationErrorResponse(error); }
}
