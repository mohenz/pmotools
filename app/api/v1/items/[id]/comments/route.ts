import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { addComment } from "@/lib/server/items";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId, userId } = getLocalContext();
  try {
    const result = await addComment(projectId, userId, id, await request.json());
    return NextResponse.json({ data: result, requestId: result.requestId }, { status: 201 });
  } catch (error) { return mutationErrorResponse(error); }
}

