// ---------------------------------------------------------------------------
// 화면 목록 규칙(설계서 5.2) — 정규화·URL 매칭·엑셀 행 검증. 순수 함수.
// ---------------------------------------------------------------------------

export const SCREEN_LIMITS = { path: 500, url: 1000, name: 255, maxRows: 5000, maxBytes: 5 * 1024 * 1024 } as const;

/** 화면경로 중복 판정 키 — 공백 정리·소문자. */
export const screenPathKey = (path: string) => path.replace(/\s+/g, " ").trim().toLowerCase();

/** 수집 URL 정규화 — 호스트 소문자, 쿼리·해시 제거, 끝의 / 제거. 해석 불가면 null. */
export function normalizeCollectedUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "")}`;
  } catch { return null; }
}

function normalizePattern(raw: string) {
  const s = raw.trim().replace(/[?#].*$/, "").replace(/\/+$/, "");
  const m = /^(https?:\/\/)([^/]*)(.*)$/i.exec(s);
  return m ? `${m[1].toLowerCase()}${m[2].toLowerCase()}${m[3]}` : s;
}

const wildcards = (p: string) => (p.match(/\*/g) ?? []).length;

function patternToRegExp(pattern: string) {
  return new RegExp(`^${pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
}

export type ScreenEntry = { id: string; path: string; url: string | null; name: string; isActive: boolean; createdAt: string };

/** 수집 URL에 맞는 화면 항목 하나. 더 구체적인(와일드카드 적고 길이 긴) 항목, 같으면 먼저 등록된 항목. 없으면 null. */
export function matchScreen(collectedUrl: string, screens: ScreenEntry[]): ScreenEntry | null {
  const url = normalizeCollectedUrl(collectedUrl);
  if (!url) return null;
  const hits = screens.filter((s) => {
    if (!s.isActive || !s.url) return false;
    const pattern = normalizePattern(s.url);
    return pattern.includes("*") ? patternToRegExp(pattern).test(url) : pattern === url;
  });
  hits.sort((a, b) => wildcards(a.url!) - wildcards(b.url!) || normalizePattern(b.url!).length - normalizePattern(a.url!).length || a.createdAt.localeCompare(b.createdAt));
  return hits[0] ?? null;
}

export type ScreenRowInput = { rowNumber: number; path: string; url: string; name: string; active: string };
export type ScreenRowError = { rowNumber: number; field: string; message: string };
export type ScreenRowOk = { rowNumber: number; path: string; pathKey: string; url: string | null; name: string; isActive: boolean };

/** 엑셀 행 검증 — 필수·길이·URL 형식·사용 여부 값·파일 안 화면경로 중복. */
export function validateScreenRows(rows: ScreenRowInput[]) {
  const errors: ScreenRowError[] = [];
  const ok: ScreenRowOk[] = [];
  const seen = new Map<string, number>();
  for (const r of rows) {
    const path = r.path.trim(); const url = r.url.trim(); const name = r.name.trim(); const active = r.active.trim().toUpperCase();
    const before = errors.length;
    if (!path) errors.push({ rowNumber: r.rowNumber, field: "화면경로", message: "필수 항목입니다." });
    else if (path.length > SCREEN_LIMITS.path) errors.push({ rowNumber: r.rowNumber, field: "화면경로", message: `${SCREEN_LIMITS.path}자 이내로 입력해 주세요.` });
    if (url) {
      if (url.length > SCREEN_LIMITS.url) errors.push({ rowNumber: r.rowNumber, field: "화면 URL", message: `${SCREEN_LIMITS.url}자 이내로 입력해 주세요.` });
      else if (!/^https?:\/\/\S+$/i.test(url)) errors.push({ rowNumber: r.rowNumber, field: "화면 URL", message: "http:// 또는 https://로 시작하는 주소여야 합니다." });
    }
    if (name.length > SCREEN_LIMITS.name) errors.push({ rowNumber: r.rowNumber, field: "화면명", message: `${SCREEN_LIMITS.name}자 이내로 입력해 주세요.` });
    if (active && active !== "Y" && active !== "N") errors.push({ rowNumber: r.rowNumber, field: "사용 여부", message: "Y 또는 N만 입력할 수 있습니다." });
    const key = screenPathKey(path);
    if (path) {
      const first = seen.get(key);
      if (first !== undefined) errors.push({ rowNumber: r.rowNumber, field: "화면경로", message: `${first}행과 화면경로가 중복됩니다.` });
      else seen.set(key, r.rowNumber);
    }
    if (errors.length === before) ok.push({ rowNumber: r.rowNumber, path, pathKey: key, url: url || null, name, isActive: active !== "N" });
  }
  return { ok, errors };
}
