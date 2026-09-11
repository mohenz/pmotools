import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { viewMessage } from "@/lib/server/messages";
import { mutationErrorResponse } from "@/lib/server/http";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await getLocalContext();
  try {
    const result = await viewMessage(userId, id, await request.json());
    return NextResponse.json({ data: result });
  } catch (error) { return mutationErrorResponse(error); }
}
