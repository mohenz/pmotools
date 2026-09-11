import { NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { listReceivedInvitations } from "@/lib/server/messages";

export async function GET() {
  const { userId } = await getLocalContext();
  return NextResponse.json({ data: await listReceivedInvitations(userId) });
}
