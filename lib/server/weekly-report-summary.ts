import "server-only";
import { GoogleGenAI } from "@google/genai";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { assertSuperAdmin } from "@/lib/server/permissions";
import {
  SUMMARY_MODEL, SUMMARY_SYSTEM_PROMPT,
  buildSummaryPrompt, computeSourceHash, hasSummarizableContent, normalizeSummaryFormatting,
  type WeeklySummaryModule,
} from "@/lib/domain/weekly-report-summary";

export type WeeklySummaryRecord = { text: string; generatedAt: string; generatedBy: string; model: string; stale: boolean };

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  geminiClient ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return geminiClient;
}

async function loadModules(projectId: string, weekId: string) {
  const week = await getPrisma().week.findFirst({
    where: { id: weekId, projectId },
    include: { reports: { include: { group: true }, orderBy: { group: { sortOrder: "asc" } } } },
  });
  if (!week) return null;
  const modules: WeeklySummaryModule[] = week.reports.map((r) => ({
    areaLabel: r.group.label, achievements: r.achievements, nextPlan: r.nextPlan, issues: r.issues, decisions: r.decisions,
  }));
  return { week, modules };
}

export async function getWeeklySummary(projectId: string, weekId: string): Promise<WeeklySummaryRecord | null> {
  const [loaded, existing] = await Promise.all([
    loadModules(projectId, weekId),
    getPrisma().weeklySummary.findUnique({ where: { weekId } }),
  ]);
  if (!loaded || !existing) return null;
  const currentHash = computeSourceHash(loaded.modules);
  return {
    text: existing.summary,
    generatedAt: existing.updatedAt.toISOString(),
    generatedBy: existing.generatedBy,
    model: existing.model,
    stale: currentHash !== existing.sourceHash,
  };
}

export async function generateWeeklySummary(projectId: string, userId: string, weekId: string): Promise<WeeklySummaryRecord> {
  await assertSuperAdmin(projectId, userId);
  const loaded = await loadModules(projectId, weekId);
  if (!loaded) throw new DomainError("NOT_FOUND", "위클리리포트를 찾을 수 없습니다.");
  if (loaded.week.status !== "closed") throw new DomainError("INVALID_STATE", "PM 확인이 완료된 리포트만 AI 요약을 생성할 수 있습니다.");
  const { modules } = loaded;
  if (!hasSummarizableContent(modules)) throw new DomainError("INVALID_STATE", "요약할 리포트 내용이 없습니다. 실적을 먼저 입력해 주세요.");

  const prompt = buildSummaryPrompt(modules);
  const sourceHash = computeSourceHash(modules);

  const response = await getGeminiClient().models.generateContent({
    model: SUMMARY_MODEL,
    contents: prompt,
    config: { systemInstruction: SUMMARY_SYSTEM_PROMPT, maxOutputTokens: 16384 },
  });
  const generatedText = response.text?.trim();
  if (!generatedText) throw new DomainError("INVALID_STATE", "요약을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  if (response.candidates?.[0]?.finishReason === "MAX_TOKENS") throw new DomainError("INVALID_STATE", "요약이 응답 길이 제한으로 중간에 잘렸습니다. 다시 시도해 주세요.");
  const summaryText = normalizeSummaryFormatting(generatedText);

  const prisma = getPrisma();
  const existing = await prisma.weeklySummary.findUnique({ where: { weekId } });
  const saved = await prisma.weeklySummary.upsert({
    where: { weekId },
    create: { weekId, summary: summaryText, sourceHash, model: SUMMARY_MODEL, generatedBy: userId },
    update: { summary: summaryText, sourceHash, model: SUMMARY_MODEL, generatedBy: userId },
  });
  await writeAuditLog(projectId, userId, existing ? "WEEKLY_SUMMARY_REGENERATE" : "WEEKLY_SUMMARY_GENERATE", "weekly_summaries", saved.id, existing, saved);

  return { text: saved.summary, generatedAt: saved.updatedAt.toISOString(), generatedBy: saved.generatedBy, model: saved.model, stale: false };
}
