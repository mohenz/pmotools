import { requireAdminContext } from "@/lib/server/context";
import { listGroups, listUsersPage } from "@/lib/server/admin";
import { listPendingPasswordResetRequests } from "@/lib/server/password-reset-requests";
import { UserManagementScreen } from "@/screens/UserManagementScreen";
import { listProjects } from "@/lib/server/projects-admin";

export const dynamic = "force-dynamic";

export default async function UsersSettingsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; pageSize?: string; scope?: string }> }) {
  const { projectId, userId, globalRole } = await requireAdminContext();
  const params = await searchParams;
  const q = params.q ?? "";
  const pageSize = params.pageSize === "all" ? "all" as const : params.pageSize && [20, 40, 80, 100].includes(Number(params.pageSize)) ? Number(params.pageSize) : 20;
  const page = Math.max(1, Number(params.page) || 1);
  // pmotools는 프로젝트 단위 화면이라 기본은 현재 프로젝트 배정자(백오피스는 전체 사용자가 기본)
  const scope = params.scope === "all" ? "all" as const : "project" as const;
  const [result, resetRequests, workGroups] = await Promise.all([
    listUsersPage(projectId, userId, { q, page, pageSize, scope }),
    listPendingPasswordResetRequests(projectId, userId),
    listGroups(projectId, "WORK_MODULE"),
  ]);
  const projects = (await listProjects()).map(({ id, code, name }) => ({ id, code, name }));
  return <UserManagementScreen result={result} filters={{ q, page, pageSize, scope }} resetRequests={resetRequests} workGroups={workGroups.filter((group) => group.isActive)} projects={projects} viewerIsSuperAdmin={globalRole === "SUPER_ADMIN"} />;
}
