import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export async function POST(request: NextRequest) {
  try {
    const { tag } = await request.json();
    if (!tag) {
      return NextResponse.json({ error: "태그가 누락되었습니다." }, { status: 400 });
    }
    
    revalidateTag(tag);
    
    return NextResponse.json({ revalidated: true, now: Date.now(), tag });
  } catch (err) {
    return NextResponse.json({ error: "웹훅 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
