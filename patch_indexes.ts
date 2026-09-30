import { config } from "dotenv";
config({ path: ".env", quiet: true });
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./lib/generated/prisma/client";

const connectionString = (process.env.DATABASE_URL ?? "").replace(/sslmode=require/, "sslmode=no-verify");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  console.log("Adding performance indexes to the database...");

  const queries = [
    // WbsItem Indexes
    `CREATE INDEX IF NOT EXISTS "idx_wbs_items_owner" ON "wbs_items"("ownerUserId");`,
    `CREATE INDEX IF NOT EXISTS "idx_wbs_items_status" ON "wbs_items"("status");`,
    `CREATE INDEX IF NOT EXISTS "idx_wbs_items_dates" ON "wbs_items"("startDate", "dueDate");`,
    
    // Issue Indexes
    `CREATE INDEX IF NOT EXISTS "idx_issues_owner" ON "issues"("ownerUserId");`,
    `CREATE INDEX IF NOT EXISTS "idx_issues_due" ON "issues"("dueAt");`,
    `CREATE INDEX IF NOT EXISTS "idx_issues_category" ON "issues"("categoryCodeId");`,
    
    // ProjectMember Indexes
    `CREATE INDEX IF NOT EXISTS "idx_project_members_user" ON "project_members"("userId");`,
  ];

  for (const q of queries) {
    try {
      await prisma.$executeRawUnsafe(q);
      console.log(`Executed: ${q}`);
    } catch (e: any) {
      console.error(`Failed: ${q}`, e.message);
    }
  }

  console.log("Indexes added successfully.");
}

main().finally(() => prisma.$disconnect());
