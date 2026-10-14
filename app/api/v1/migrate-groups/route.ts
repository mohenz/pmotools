import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db-pg";
import { resolveRootProjectId } from "@/lib/server/project-access";

export async function GET() {
  try {
    const prisma = getPrisma();
    
    // 1. Find all WORK_MODULE groups
    const groups = await prisma.groups.findMany({
      where: { groupType: "WORK_MODULE" }
    });
    
    let migrated = 0;
    for (const group of groups) {
      const rootId = await resolveRootProjectId(group.projectId);
      if (rootId !== group.projectId) {
        await prisma.groups.update({
          where: { id: group.id },
          data: { projectId: rootId }
        });
        migrated++;
      }
    }
    
    return NextResponse.json({ success: true, total: groups.length, migrated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
