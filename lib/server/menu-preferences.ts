import "server-only";
import { z } from "zod";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { assertManager } from "@/lib/server/permissions";
import { DEFAULT_MENU_ITEMS, type MenuPreferenceRow } from "@/lib/domain/menu-preferences";

export type { MenuPreferenceRow };
export { DEFAULT_MENU_ITEMS };

export async function listMenuPreferences(projectId: string): Promise<MenuPreferenceRow[]> {
  const rows = await getPrisma().menuPreference.findMany({ where: { projectId } });
  const byKey = new Map(rows.map((row) => [row.menuKey, row]));
  return DEFAULT_MENU_ITEMS
    .map((item, index) => {
      const saved = byKey.get(item.key);
      return {
        key: item.key, label: saved?.label ?? item.label,
        visibleAdmin: saved?.visibleAdmin ?? true, visibleOperator: saved?.visibleOperator ?? true, visibleMember: saved?.visibleMember ?? true,
        sortOrder: saved?.sortOrder ?? index,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "ko"));
}

const updateSchema = z.array(z.object({
  key: z.enum(DEFAULT_MENU_ITEMS.map((item) => item.key) as [string, ...string[]]),
  label: z.string().trim().min(1, "메뉴명을 입력해 주세요.").max(40, "메뉴명은 40자 이하여야 합니다."),
  visibleAdmin: z.boolean(),
  visibleOperator: z.boolean(),
  visibleMember: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
})).length(DEFAULT_MENU_ITEMS.length);

export async function updateMenuPreferences(projectId: string, actorId: string, input: unknown) {
  await assertManager(projectId, actorId);
  const data = updateSchema.parse(input);
  const prisma = getPrisma();
  await prisma.$transaction(data.map((item) => prisma.menuPreference.upsert({
    where: { projectId_menuKey: { projectId, menuKey: item.key } },
    create: { projectId, menuKey: item.key, label: item.label, visibleAdmin: item.visibleAdmin, visibleOperator: item.visibleOperator, visibleMember: item.visibleMember, sortOrder: item.sortOrder },
    update: { label: item.label, visibleAdmin: item.visibleAdmin, visibleOperator: item.visibleOperator, visibleMember: item.visibleMember, sortOrder: item.sortOrder },
  })));
  await writeAuditLog(projectId, actorId, "MENU_PREFERENCES_UPDATE", "menu_preferences", projectId, null, data);
  return listMenuPreferences(projectId);
}
