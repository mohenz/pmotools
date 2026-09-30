import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db-pg";
import { getLocalContext } from "@/lib/server/context";

export async function GET() {
  const { userId } = await getLocalContext();
  const memberships = await getPrisma().projectMember.findMany({
    where: { userId, isActive: true },
    select: { role: true, project: { select: { id: true, code: true, name: true } } },
    orderBy: { project: { name: "asc" } },
  });
  return NextResponse.json({
    data: memberships.map((m) => ({ projectId: m.project.id, code: m.project.code, name: m.project.name, role: m.role })),
  });
}
