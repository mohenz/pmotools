import "server-only";

import { getPrisma } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";

export async function assertWorkModuleGroup(projectId: string, groupId: string) {
  const group = await getPrisma().groups.findUnique({ where: { id: groupId } });
  if (!group || group.projectId !== projectId || group.groupType !== "WORK_MODULE" || !group.isActive) throw new DomainError("INVALID_CODE", "선택한 Track을 사용할 수 없습니다.");
  return group;
}
