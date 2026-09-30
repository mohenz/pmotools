import "server-only";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { getPrisma } from "@/lib/server/db-pg";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/domain/session";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        userId: { label: "아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
        projectCode: { label: "프로젝트 코드", type: "text" },
      },
      async authorize(credentials) {
        try {
          const userId = typeof credentials?.userId === "string" ? credentials.userId.trim() : "";
          const password = typeof credentials?.password === "string" ? credentials.password : "";
          const projectCode = typeof credentials?.projectCode === "string" ? credentials.projectCode.trim() : "";
          if (!userId || !password || !projectCode) return null;

          const prisma = getPrisma();
          const user = await prisma.user.findUnique({ where: { userId } });
          if (!user || user.status === "LOCKED" || user.deletedAt) return null;
          const valid = await compare(password, user.passwordHash);
          if (!valid) return null;

          const project = await prisma.project.findUnique({ where: { code: projectCode } });
          if (!project) return null;

          // 사용자 계정(User)은 프로젝트 간 공유되는 단일 아이디이며, ProjectMember가
          // "이 계정이 어느 프로젝트에 어떤 역할로 소속되어 있는지"를 나타낸다. 로그인 시
          // 프로젝트 코드를 명시적으로 받아 해당 소속 여부를 확인해야 다중 프로젝트 운영이 가능하다.
          const membership = await prisma.projectMember.findUnique({
            where: { projectId_userId: { projectId: project.id, userId: user.id } },
          });

          if (!membership?.isActive) return null;
          return {
            id: user.id,
            name: user.name,
            loginId: user.userId,
            role: membership.role,
            projectId: project.id,
          };
        } catch (e) {
          console.error("AUTHORIZE ERROR:", e);
          throw e;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.userId = user.id;
        token.loginId = (user as { loginId: string }).loginId;
        token.role = (user as { role: string }).role;
        token.projectId = (user as { projectId: string }).projectId;
      }
      // 프로젝트 스위처: 클라이언트가 useSession().update({ projectId })를 호출하면 여기로 들어온다.
      // 세션 쿠키는 사용자가 조작할 수 있으므로, 요청된 프로젝트에 실제로 활성 소속되어 있는지
      // 항상 DB에서 재검증한 뒤에만 토큰의 projectId/role을 교체한다.
      if (trigger === "update" && typeof session?.projectId === "string" && token.userId) {
        const membership = await getPrisma().projectMember.findUnique({
          where: { projectId_userId: { projectId: session.projectId, userId: token.userId as string } },
        });
        if (membership?.isActive) {
          token.projectId = membership.projectId;
          token.role = membership.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // DB 조회 실패(연결 오류 등) 시 JWTSessionError로 전파되지 않도록 방어 처리.
      // 실패 시 JWT 토큰의 스냅샷 값으로 폴백하여 세션 자체는 유지한다.
      let profile: { jobTitle: string | null; role: string } | null = null;
      let membership: { role: string; isActive: boolean } | null = null;
      try {
        const prisma = getPrisma();
        [profile, membership] = await Promise.all([
          token.userId ? prisma.user.findUnique({ where: { id: token.userId as string }, select: { jobTitle: true, role: true } }) : null,
          // role: JWT 토큰은 로그인 시점 스냅샷이므로 DB 변경을 반영하지 못한다.
          // ProjectMember.role을 매 요청마다 DB에서 실시간 조회하여 세션을 동기화한다.
          token.userId && token.projectId
            ? prisma.projectMember.findUnique({
                where: { projectId_userId: { projectId: token.projectId as string, userId: token.userId as string } },
                select: { role: true, isActive: true },
              })
            : null,
        ]);
      } catch (e) {
        console.error("[auth][session] DB 조회 실패 — JWT 토큰 폴백 사용:", e);
      }
      session.user.id = token.userId as string;
      session.user.loginId = token.loginId as string;
      const globalRole = (profile?.role ?? "MEMBER") as "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "MEMBER";
      // role: 현재 세션이 활성화된 "프로젝트 내에서의" 역할(ProjectMember.role) — 프로젝트별 화면 접근 제어에 사용.
      // globalRole: 프로젝트와 무관한 "플랫폼 전역" 역할(User.role) — 프로젝트 생성, 플랫폼 공통코드 등
      // 특정 프로젝트에 속하지 않는 백오피스 기능의 접근 제어에 사용한다.
      // 단, 플랫폼 SUPER_ADMIN은 어떤 프로젝트에 실제로 소속되어 있는지와 무관하게 모든 프로젝트를
      // 관리할 수 있어야 하므로(기존 requireAdminContext 등 프로젝트별 화면 가드가 role만 검사함),
      // globalRole이 SUPER_ADMIN이면 role도 SUPER_ADMIN으로 승격시킨다.
      session.user.role = (globalRole === "SUPER_ADMIN" ? "SUPER_ADMIN" : ((membership?.isActive ? membership.role : null) ?? token.role)) as "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "MEMBER";
      session.user.globalRole = globalRole;
      session.user.projectId = token.projectId as string;
      session.user.jobTitle = profile?.jobTitle ?? null;
      return session;
    },
  },
});
