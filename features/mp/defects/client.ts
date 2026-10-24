"use client";

// 결함관리 화면 공통 — API 호출.
export async function defectApi<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  const response = await fetch(`/api/v1/mp/defects/${path}`, { ...init, headers: isForm ? init.headers : { "content-type": "application/json", ...init.headers } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? "요청을 처리하지 못했습니다.");
  return payload?.data as T;
}

export const json = (method: string, data?: unknown): RequestInit => ({ method, body: data === undefined ? undefined : JSON.stringify(data) });

export const STATUS_CLASS_LABEL: Record<string, string> = { OPEN: "미조치", DONE: "조치완료", CLOSED: "종결" };
export const STATUS_CLASS_BADGE: Record<string, string> = { OPEN: "band-red", DONE: "band-yellow", CLOSED: "band-green" };
