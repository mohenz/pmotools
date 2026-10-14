import { requireSuperAdminContext } from "@/lib/server/context";
import { listProjects } from "@/lib/server/projects-admin";
import { ProjectManagementScreen } from "@/screens/ProjectManagementScreen";

export const dynamic = "force-dynamic";

export default async function ProjectsSettingsPage() {
  await requireSuperAdminContext();
  const projects = await listProjects();
  return <ProjectManagementScreen projects={projects} />;
}
