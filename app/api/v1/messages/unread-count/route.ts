import { NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { unreadMessageCount } from "@/lib/server/messages";

export async function GET() {
  const { userId } = await getLocalContext();
  return NextResponse.json({ data: { count: await unreadMessageCount(userId) } });
}
