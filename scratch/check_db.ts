import { PrismaClient } from "../lib/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || "postgresql://johndoe:randompassword@localhost:55432/mydb?schema=public" });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  
  try {
    const users = await prisma.user.findMany({
      select: { userId: true, status: true, deletedAt: true }
    });
    console.log("Users:", users);

    const defaultProjectId = "20000000-0000-4000-8000-000000000001";
    const project = await prisma.project.findUnique({ where: { id: defaultProjectId } });
    console.log("Default Project Exists:", !!project);

    const members = await prisma.projectMember.findMany({
      where: { projectId: defaultProjectId },
      include: { user: { select: { userId: true } } }
    });
    console.log("Members in Default Project:", members.map(m => ({ userId: m.user.userId, isActive: m.isActive })));
  } catch (e) {
    console.error("DB Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
