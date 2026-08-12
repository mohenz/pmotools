import "server-only";
import { getPrisma } from "@/lib/server/db-pg";

export type ProjectMemberOption = { id: string; userId: string; name: string };

export async function listProjectMembers(projectId: string): Promise<ProjectMemberOption[]> {
  const members = await getPrisma().projectMember.findMany({ where: { projectId, isActive: true, user: { status: "ACTIVE" } }, include: { user: true } });
  return members.map((member) => ({ id: member.user.id, userId: member.user.userId, name: member.user.name })).sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
