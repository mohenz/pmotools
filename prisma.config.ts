import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: false });

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // 로컬 PostgreSQL을 기본으로 사용하고 기존 배포 환경 변수는 호환 목적으로 유지한다.
    url: process.env.DATABASE_URL ?? process.env.POSTGRES_URL_NON_POOLING,
  },
});
