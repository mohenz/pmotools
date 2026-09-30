import { NextRequest, NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/server/context";
import { getLoginImage, resetLoginImage, setLoginImage } from "@/lib/server/login-image";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** GET — 현재 로그인 배경 이미지 URL 반환 (비인증 허용) */
export async function GET() {
  try {
    const image = await getLoginImage("MAIN");
    const url = image
      ? `/api/v1/settings/login-image/file?v=${image.updatedAt.getTime()}`
      : `/bg_image1.png`;
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[login-image] GET error:", err);
    return NextResponse.json({ url: `/bg_image1.png` }, { headers: { "Cache-Control": "no-store" } });
  }
}

/** POST — 이미지 업로드 (ADMIN 이상) */
export async function POST(req: NextRequest) {
  let userId: string;
  try {
    const context = await requireAdminContext();
    userId = context.userId;
  } catch {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) return NextResponse.json({ error: "이미지 파일이 없습니다." }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "JPEG, PNG, WebP 형식만 지원합니다." }, { status: 400 });
    if (file.size > MAX_SIZE_BYTES) return NextResponse.json({ error: "파일 크기는 5MB 이하여야 합니다." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const image = await setLoginImage("MAIN", buffer, file.type, userId);

    return NextResponse.json({
      url: `/api/v1/settings/login-image/file?v=${image.updatedAt.getTime()}`,
      message: "업로드 완료",
    });
  } catch (err) {
    console.error("[login-image] POST error:", err);
    return NextResponse.json({ error: "업로드 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

/** DELETE — 기본 이미지로 복원 (ADMIN 이상) */
export async function DELETE() {
  try {
    await requireAdminContext();
  } catch {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  try {
    await resetLoginImage("MAIN");
    return NextResponse.json({ url: `/bg_image1.png`, message: "기본 이미지로 복원되었습니다." });
  } catch (err) {
    console.error("[login-image] DELETE error:", err);
    return NextResponse.json({ error: "복원 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
