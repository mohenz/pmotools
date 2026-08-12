import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "@/lib/server/errors";

export function mutationErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "입력값을 확인해 주세요.", fieldErrors: error.flatten().fieldErrors } }, { status: 400 });
  }
  if (error instanceof DomainError) {
    const status = error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : error.code === "INVALID_CODE" || error.code === "LAST_ACTIVE_CODE" ? 400 : 409;
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status });
  }
  console.error(error);
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "요청 처리 중 오류가 발생했습니다." } }, { status: 500 });
}
