import { config } from "dotenv";
config({ path: ".env" });
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const connectionString = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function checkUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, userId: true, name: true, role: true, status: true },
    take: 15,
  });
  console.log("TOTAL USERS COUNT:", await prisma.user.count());
  console.log("FIRST 15 USERS IN RESTORED DB:", users);

  const pmoAdmin = await prisma.user.findUnique({ where: { userId: "pmo.admin" } });
  const { hashSync } = require("bcryptjs");
  const newHash = hashSync("ChangeMe!2026", 12);
  await prisma.user.update({
    where: { userId: "pmo.admin" },
    data: { passwordHash: newHash }
  });
  console.log("pmo.admin password reset to ChangeMe!2026");
}

checkUsers().finally(() => prisma.$disconnect());
