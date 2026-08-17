import { requireAdminContext } from "@/lib/server/context";
import { listUsers } from "@/lib/server/admin";
import { listPendingPasswordResetRequests } from "@/lib/server/password-reset-requests";
import { UserManagementScreen } from "@/screens/UserManagementScreen";

export const dynamic = "force-dynamic";

export default async function UsersSettingsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { projectId, userId } = await requireAdminContext();
  const q = (await searchParams).q ?? "";
  const [users, resetRequests] = await Promise.all([
    listUsers(projectId, userId, q || undefined),
    listPendingPasswordResetRequests(projectId, userId),
  ]);
  return <UserManagementScreen users={users} q={q} resetRequests={resetRequests} />;
}
