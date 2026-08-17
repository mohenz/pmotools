import { requireManagerContext } from "@/lib/server/context";
import { listMenuPreferences } from "@/lib/server/menu-preferences";
import { MenuPreferencesScreen } from "@/features/settings/MenuPreferencesScreen";

export const dynamic = "force-dynamic";

export default async function MenuPreferencesPage() {
  const { projectId } = await requireManagerContext();
  const items = await listMenuPreferences(projectId);
  return <MenuPreferencesScreen initial={items} />;
}
