import { NextRequest, NextResponse } from "next/server";
import { getLoginImage } from "@/lib/server/login-image";

/** GET — 로그인 배경 이미지 바이너리 스트리밍 (비인증 허용) */
export async function GET(req: NextRequest) {
  const image = await getLoginImage("MAIN");
  if (!image) {
    return NextResponse.redirect(new URL("/bg_image1.png", req.url));
  }
  return new NextResponse(image.data, {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "no-store",
    },
  });
}
