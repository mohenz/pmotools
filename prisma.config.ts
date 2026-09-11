import { config } from "dotenv";
config({ path: ".env", quiet: true });
config({ path: ".env.local", override: false, quiet: true });

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Vercel 빌드에서는 저장소의 로컬 DATABASE_URL보다 production DB를 우선한다.
    url: process.env.VERCEL === "1"
      ? process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL
      : process.env.DATABASE_URL ?? process.env.POSTGRES_URL_NON_POOLING,
  },
});
