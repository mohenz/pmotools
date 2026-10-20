"use client";

// 단위테스트 화면 공통 — API 호출.
export async function utApi<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  const response = await fetch(`/api/v1/mp/ut/${path}`, { ...init, headers: isForm ? init.headers : { "content-type": "application/json", ...init.headers } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? "요청을 처리하지 못했습니다.");
  return payload?.data as T;
}

export const json = (method: string, data?: unknown): RequestInit => ({ method, body: data === undefined ? undefined : JSON.stringify(data) });
