import { NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { listActiveWorkNotices } from "@/lib/server/announcements";

// 로그인 후 작업 알림 팝업 — 지금 안내 중인 작업 알림(2026-10-01)
export async function GET() {
  const { projectId, userId } = await getLocalContext();
  return NextResponse.json({ data: await listActiveWorkNotices(projectId, userId) });
}
