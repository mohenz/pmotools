import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { createItem, listItems } from "@/lib/server/items";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const { projectId } = getLocalContext();
  const params = request.nextUrl.searchParams;
  const items = await listItems(projectId, {
    q: params.get("q") ?? undefined,
    kind: params.get("kind") ?? undefined,
    status: params.get("status") ?? undefined,
    category: params.get("category") ?? undefined,
    probability: params.get("probability") ?? undefined,
    impact: params.get("impact") ?? undefined,
    open: params.get("open") === "true",
    stale: params.get("stale") === "true",
    page: Number(params.get("page")) || 1,
    pageSize: Number(params.get("pageSize")) || 30,
  });
  return NextResponse.json({ data: items });
}

export async function POST(request: NextRequest) {
  const { projectId, userId } = getLocalContext();
  try {
    const item = await createItem(projectId, userId, await request.json());
    return NextResponse.json({ data: item, requestId: item.requestId }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

