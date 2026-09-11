import { compare } from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

async function testLogin(userId: string, password: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || "postgresql://johndoe:randompassword@localhost:55432/mydb?schema=public" });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log(`Testing login for: ${userId}`);
  
  try {
    const user = await prisma.user.findUnique({ where: { userId } });
    if (!user) {
      console.log("User not found in DB.");
      return;
    }
    console.log(`User found: status=${user.status}, deletedAt=${user.deletedAt}`);
    
    if (user.status === "LOCKED" || user.deletedAt) {
      console.log("User is locked or deleted.");
      return;
    }

    const valid = await compare(password, user.passwordHash);
    console.log(`Password check result: ${valid}`);
    
    if (!valid) {
      console.log("Invalid password.");
      return;
    }

    const DEFAULT_PROJECT_ID = "20000000-0000-4000-8000-000000000001";
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: DEFAULT_PROJECT_ID, userId: user.id } },
    });

    if (!membership) {
      console.log("No membership found in DEFAULT_PROJECT_ID.");
      return;
    }

    console.log(`Membership found: isActive=${membership.isActive}, role=${membership.role}`);
    
    if (!membership.isActive) {
      console.log("Membership is not active.");
      return;
    }

    console.log("Login SUCCESS! Returned data:", {
      id: user.id,
      name: user.name,
      loginId: user.userId,
      role: membership?.role ?? user.role,
      projectId: DEFAULT_PROJECT_ID,
    });

  } catch (e) {
    console.error("Error during testLogin:", e);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin("pmo.admin", "ChangeMe!2026");
