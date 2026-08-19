import { requireAdminContext } from "@/lib/server/context";
import { listUsersPage } from "@/lib/server/admin";
import { listPendingPasswordResetRequests } from "@/lib/server/password-reset-requests";
import { UserManagementScreen } from "@/screens/UserManagementScreen";

export const dynamic = "force-dynamic";

export default async function UsersSettingsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; pageSize?: string }> }) {
  const { projectId, userId } = await requireAdminContext();
  const params = await searchParams;
  const q = params.q ?? "";
  const pageSize = params.pageSize === "all" ? "all" as const : params.pageSize && [20, 40, 80, 100].includes(Number(params.pageSize)) ? Number(params.pageSize) : 20;
  const page = Math.max(1, Number(params.page) || 1);
  const [result, resetRequests] = await Promise.all([
    listUsersPage(projectId, userId, { q, page, pageSize }),
    listPendingPasswordResetRequests(projectId, userId),
  ]);
  return <UserManagementScreen result={result} filters={{ q, page, pageSize }} resetRequests={resetRequests} />;
}
