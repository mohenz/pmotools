import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "@/lib/server/errors";

// ---------------------------------------------------------------------------
// 단위테스트 증적 저장소(설계서 9장 "증적 저장소", C6).
// 운영: 내부 서버 D:\product\ut_evidence (UT_EVIDENCE_ROOT) — 실행 계정은 읽기·쓰기만, 삭제 권한 없음.
// 그래서 임시 폴더(UT_EVIDENCE_TMP)에 쓰고 해시를 계산한 뒤 저장 루트로 "복사(배타 생성)"하고 임시 파일만 지운다.
// 로컬 개발: 환경변수가 없으면 프로젝트 폴더의 .ut-evidence / .ut-evidence-tmp (gitignore).
// ---------------------------------------------------------------------------

const ALLOWED = new Set(["png", "jpg", "jpeg", "gif", "webp", "pdf", "txt", "log", "json", "xml", "html", "csv", "xls", "xlsx", "doc", "docx", "ppt", "pptx", "zip"]);
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", pdf: "application/pdf", txt: "text/plain", log: "text/plain", json: "application/json", xml: "application/xml", html: "text/html", csv: "text/csv", xls: "application/vnd.ms-excel", doc: "application/msword", ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", zip: "application/zip" };

function root() { return process.env.UT_EVIDENCE_ROOT || path.join(process.cwd(), ".ut-evidence"); }
function tmpRoot() { return process.env.UT_EVIDENCE_TMP || path.join(process.cwd(), ".ut-evidence-tmp"); }
function maxBytes() { return (Number(process.env.UT_EVIDENCE_MAX_MB) || 20) * 1024 * 1024; }

export function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

export function assertEvidenceFile(file: { name: string; size: number }) {
  const ext = extensionOf(file.name);
  if (!ALLOWED.has(ext)) throw new DomainError("INVALID_CODE", `허용되지 않은 증적 파일 형식입니다(${ext || "확장자 없음"}). 허용: ${[...ALLOWED].join(", ")}`);
  if (file.size <= 0) throw new DomainError("INVALID_CODE", "빈 파일은 증적으로 올릴 수 없습니다.");
  if (file.size > maxBytes()) throw new DomainError("INVALID_CODE", `증적 파일은 ${maxBytes() / 1024 / 1024}MB 이하만 올릴 수 있습니다.`);
}

/** 경로에 사용자 입력을 쓰지 않는다 — {프로젝트코드}/{yyyy}/{MM}/{evidenceId}.{ext} (프로젝트 코드는 영숫자·-·_만 남김) */
export function storageKeyOf(projectCode: string, evidenceId: string, fileName: string, now = new Date()) {
  const safeCode = projectCode.replace(/[^A-Za-z0-9_-]/g, "_") || "PROJECT";
  return `${safeCode}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${evidenceId}.${extensionOf(fileName)}`;
}

export async function saveEvidenceFile(projectCode: string, evidenceId: string, file: File) {
  assertEvidenceFile(file);
  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storageKey = storageKeyOf(projectCode, evidenceId, file.name);
  const tmpPath = path.join(tmpRoot(), `${randomUUID()}.part`);
  const finalPath = path.join(root(), ...storageKey.split("/"));
  await mkdir(tmpRoot(), { recursive: true });
  await mkdir(path.dirname(finalPath), { recursive: true });
  await writeFile(tmpPath, bytes);
  try {
    await copyFile(tmpPath, finalPath, constants.COPYFILE_EXCL); // 덮어쓰기 금지
  } finally {
    await rm(tmpPath, { force: true });
  }
  const ext = extensionOf(file.name);
  return { storageKey, sizeBytes: bytes.length, sha256, mimeType: MIME[ext] ?? "application/octet-stream" };
}

export async function readEvidenceFile(storageKey: string) {
  if (storageKey.includes("..")) throw new DomainError("NOT_FOUND", "증적 파일을 찾을 수 없습니다.");
  const filePath = path.join(root(), ...storageKey.split("/"));
  try {
    await stat(filePath);
  } catch {
    throw new DomainError("NOT_FOUND", "증적 파일이 저장소에 없습니다. 관리자에게 문의해 주세요.");
  }
  return readFile(filePath);
}

/** 감사·샘플링용 수기 무결성 점검(9장) — 저장 파일 해시를 다시 계산해 비교. */
export async function verifyEvidenceHash(storageKey: string, sha256: string) {
  const bytes = await readEvidenceFile(storageKey);
  return createHash("sha256").update(bytes).digest("hex") === sha256;
}
