import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { listMessages, sendMessage } from "@/lib/server/messages";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const { userId } = await getLocalContext();
  const box = request.nextUrl.searchParams.get("box") === "sent" ? "sent" : "received";
  return NextResponse.json({ data: await listMessages(userId, box) });
}

export async function POST(request: NextRequest) {
  const { userId } = await getLocalContext();
  try {
    const result = await sendMessage(userId, await request.json());
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) { return mutationErrorResponse(error); }
}
