import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { createWbsItem, listWbsItems } from "@/lib/server/wbs";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET() {
  const { projectId } = await getLocalContext();
  const items = await listWbsItems(projectId);
  return NextResponse.json({ data: items });
}

export async function POST(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  try {
    const item = await createWbsItem(projectId, userId, await request.json());
    return NextResponse.json({ data: item, requestId: item.requestId }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
