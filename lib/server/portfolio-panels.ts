import "server-only";
import { z } from "zod";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { assertManager } from "@/lib/server/permissions";
import { DEFAULT_PORTFOLIO_PANELS, type PortfolioPanelRow } from "@/lib/domain/portfolio-panels";

export type { PortfolioPanelRow };
export { DEFAULT_PORTFOLIO_PANELS };

export async function listPortfolioPanelPreferences(projectId: string): Promise<PortfolioPanelRow[]> {
  const rows = await getPrisma().portfolioPanelPreference.findMany({ where: { projectId } });
  const byKey = new Map(rows.map((row) => [row.panelKey, row]));
  return DEFAULT_PORTFOLIO_PANELS.map((item) => ({
    key: item.key, label: item.label,
    visible: byKey.get(item.key)?.visible ?? true,
  }));
}

const updateSchema = z.array(z.object({
  key: z.enum(DEFAULT_PORTFOLIO_PANELS.map((item) => item.key) as [string, ...string[]]),
  visible: z.boolean(),
})).length(DEFAULT_PORTFOLIO_PANELS.length);

export async function updatePortfolioPanelPreferences(projectId: string, actorId: string, input: unknown) {
  await assertManager(projectId, actorId);
  const data = updateSchema.parse(input);
  const prisma = getPrisma();
  await prisma.$transaction(data.map((item) => prisma.portfolioPanelPreference.upsert({
    where: { projectId_panelKey: { projectId, panelKey: item.key } },
    create: { projectId, panelKey: item.key, visible: item.visible },
    update: { visible: item.visible },
  })));
  await writeAuditLog(projectId, actorId, "PORTFOLIO_PANEL_PREFERENCES_UPDATE", "portfolio_panel_preferences", projectId, null, data);
  return listPortfolioPanelPreferences(projectId);
}
