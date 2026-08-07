import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // 마이그레이션은 PgBouncer 풀링을 거치지 않는 직접 연결을 사용해야 함
    url: process.env.POSTGRES_URL_NON_POOLING,
  },
});
