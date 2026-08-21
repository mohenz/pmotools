import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "tests-e2e/**", "tests-jest/**"],
    alias: [
      // "@prisma/..." 같은 스코프 패키지가 걸리지 않도록 "@/" 접두사만 치환한다.
      { find: /^@\//, replacement: root },
      { find: /^server-only$/, replacement: `${root}test/stubs/server-only.ts` },
    ],
  },
});
