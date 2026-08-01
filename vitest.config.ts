import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(() => {
  const env = loadEnv("development", process.cwd(), "");
  return {
    test: {
      env: { DATABASE_URL: env.DATABASE_URL },
    },
  };
});

