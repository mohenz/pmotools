import { NextResponse } from "next/server";
import { createPasswordResetRequest } from "@/lib/server/password-reset-requests";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  try {
    await createPasswordResetRequest(body);
  } catch {
    // 검증 오류라도 계정 존재 여부가 드러나지 않도록 동일한 응답을 반환합니다.
  }
  return NextResponse.json({ data: { ok: true } });
}
