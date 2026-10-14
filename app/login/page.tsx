import { getPrisma } from "@/lib/server/db-pg";
import { LoginClient } from "./LoginClient";
import { unstable_cache } from "next/cache";

// DB를 찌르는 캐시 함수 (태그: 'login-data')
const getLoginData = unstable_cache(
  async () => {
    const prisma = getPrisma();
    let projects: { code: string; name: string }[] = [];
    
    // 1. 프로젝트 목록 조회 (isPublic 자동 생성 및 정렬 반영)
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT true;`);
    } catch (e) {
      // ignore
    }
    try {
      projects = await prisma.$queryRaw<{ code: string; name: string }[]>`SELECT code, name FROM projects WHERE "isPublic" = true ORDER BY "sortOrder" ASC, name ASC`;
    } catch (e) {
      projects = await prisma.$queryRaw<{ code: string; name: string }[]>`SELECT code, name FROM projects ORDER BY "sortOrder" ASC, name ASC`;
    }

    // 2. 로그인 배경 이미지 URL 조회 (최적화)
    let loginBgUrl = "/login-bg.webp";
    try {
      const img = await prisma.loginImage.findUnique({
        where: { scope: "MAIN" },
        select: { id: true, updatedAt: true }
      });
      if (img) loginBgUrl = `/api/v1/settings/login-image/file?v=${img.updatedAt.getTime()}`;
    } catch (e) {
      // ignore
    }

    return { projects, loginBgUrl };
  },
  ["login-data-key"], // cache key
  { tags: ["login-data"] } // webhook 갱신용 tag
);

export default async function LoginPage() {
  const { projects, loginBgUrl } = await getLoginData();
  return <LoginClient projects={projects} loginBgUrl={loginBgUrl} />;
}
