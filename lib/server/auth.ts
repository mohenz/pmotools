import "server-only";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { getPrisma } from "@/lib/server/db-pg";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/domain/session";
import { hasAllProjectAccess, effectiveProjectRole, type AccountRole } from "@/lib/domain/project-access";
import { listAccessibleProjects, resolveProjectRole } from "@/lib/server/project-access";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
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
          
          // [성능 개선] user, project 개별 조회에 따른 네트워크 대기 시간을 줄이기 위해 병렬 조회 처리
          const [user, project] = await Promise.all([
            prisma.user.findUnique({ where: { userId } }),
            prisma.project.findUnique({ where: { code: projectCode } })
          ]);

          if (!user || user.status === "LOCKED" || user.deletedAt) return null;
          if (!project) return null;

          const valid = await compare(password, user.passwordHash);
          if (!valid) return null;

          // [성능 개선] resolveProjectRole가 user와 project를 DB에서 재조회하는 문제 제거.
          // 이미 메모리에 로드된 객체를 활용하고 필요한 경우에만 membership 단건을 조회함.
          let isActiveMember = false;
          if (hasAllProjectAccess(user.role)) {
            isActiveMember = true;
          } else {
            const membership = await prisma.projectMember.findUnique({
              where: { projectId_userId: { projectId: project.id, userId: user.id } },
              select: { isActive: true }
            });
            isActiveMember = Boolean(membership?.isActive);
          }

          const role = effectiveProjectRole(user.role, isActiveMember);
          if (!role) return null;
          return {
            id: user.id,
            name: user.name,
            loginId: user.userId,
            role,
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
      // 세션 쿠키는 사용자가 조작할 수 있으므로, 요청된 프로젝트에 실제로 접근할 수 있는지(관리자 이상 또는 배정)
      // 항상 DB에서 재검증한 뒤에만 토큰의 projectId/role을 교체한다.
      if (trigger === "update" && typeof session?.projectId === "string" && token.userId) {
        const role = await resolveProjectRole(token.userId as string, session.projectId);
        if (role) {
          token.projectId = session.projectId;
          token.role = role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // 매 요청마다 계정 역할과 배정 여부를 DB에서 다시 확인한다 — 로그인 후 역할이 바뀌거나 배정이 해제돼도 즉시 반영.
      // 현재 프로젝트 접근이 끊겼으면 접근 가능한 첫 프로젝트(노출 우선순위 순)로 옮기고, 하나도 없으면 projectAccess=false.
      // DB 조회 실패(연결 오류 등) 시 JWTSessionError로 전파되지 않도록 토큰 스냅샷 값으로 폴백한다.
      let profile: { jobTitle: string | null; role: string } | null = null;
      let role: AccountRole | null | undefined;
      let projectId = (token.projectId as string) ?? "";
      try {
        const userId = token.userId as string;
        if (userId) {
          const prisma = getPrisma();
          // [성능 개선] 매 요청마다 발생하는 session 검증 시, user 조회와 resolveProjectRole 내부의 
          // 중복 user 조회 및 project 조회를 제거하고 한 번의 병렬 I/O로 통합.
          const [userRecord, projectRecord, membership] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId }, select: { jobTitle: true, role: true, status: true, deletedAt: true } }),
            prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }),
            prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } }, select: { isActive: true } })
          ]);
          
          profile = userRecord;
          if (userRecord && !userRecord.deletedAt && userRecord.status !== "LOCKED" && projectRecord) {
            role = effectiveProjectRole(userRecord.role, Boolean(membership?.isActive));
          } else {
            role = null;
          }

          if (!role) {
            const next = (await listAccessibleProjects(userId))[0];
            if (next) { projectId = next.projectId; role = next.role; }
          }
        }
      } catch (e) {
        console.error("[auth][session] DB 조회 실패 — JWT 토큰 폴백 사용:", e);
        role = undefined;
      }
      session.user.id = token.userId as string;
      session.user.loginId = token.loginId as string;
      const globalRole = (profile?.role ?? "MEMBER") as AccountRole;
      // role: 현재 프로젝트에서 동작하는 역할 = 계정 역할(접근할 수 있을 때). globalRole: 계정 역할 그 자체(플랫폼 기능 판단용).
      session.user.role = (role ?? (token.role as AccountRole | undefined) ?? "MEMBER") as AccountRole;
      session.user.globalRole = globalRole;
      session.user.projectId = projectId;
      session.user.projectAccess = role !== null || hasAllProjectAccess(globalRole);
      session.user.jobTitle = profile?.jobTitle ?? null;
      return session;
    },
  },
});
