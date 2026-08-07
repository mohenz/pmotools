import { requireAdminContext } from "@/lib/server/context";
import { listUsers } from "@/lib/server/admin";
import { UserManagementScreen } from "@/screens/UserManagementScreen";

export const dynamic = "force-dynamic";

export default async function UsersSettingsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { projectId, userId } = await requireAdminContext();
  const q = (await searchParams).q ?? "";
  const users = await listUsers(projectId, userId, q || undefined);
  return <UserManagementScreen users={users} q={q} />;
}
