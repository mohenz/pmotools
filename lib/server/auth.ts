import "server-only";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { getPrisma } from "@/lib/server/db-pg";
import { DEFAULT_PROJECT_ID } from "@/lib/domain/constants";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        userId: { label: "아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        const userId = typeof credentials?.userId === "string" ? credentials.userId.trim() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!userId || !password) return null;

        const prisma = getPrisma();
        const user = await prisma.user.findUnique({ where: { userId } });
        if (!user || user.status === "LOCKED" || user.deletedAt) return null;
        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        const membership = await prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: DEFAULT_PROJECT_ID, userId: user.id } },
        });

        if (!membership?.isActive) return null;
        return {
          id: user.id,
          name: user.name,
          loginId: user.userId,
          role: membership?.role ?? user.role,
          projectId: DEFAULT_PROJECT_ID,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.loginId = (user as { loginId: string }).loginId;
        token.role = (user as { role: string }).role;
        token.projectId = (user as { projectId: string }).projectId;
      }
      return token;
    },
    async session({ session, token }) {
      const profile = token.userId ? await getPrisma().user.findUnique({ where: { id: token.userId as string }, select: { jobTitle: true } }) : null;
      session.user.id = token.userId as string;
      session.user.loginId = token.loginId as string;
      session.user.role = token.role as "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "MEMBER";
      session.user.projectId = token.projectId as string;
      session.user.jobTitle = profile?.jobTitle ?? null;
      return session;
    },
  },
});
