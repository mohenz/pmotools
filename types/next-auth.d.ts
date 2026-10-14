import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    loginId: string;
    role: "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "MEMBER";
    projectId: string;
  }

  interface Session {
    user: {
      id: string;
      loginId: string;
      role: "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "MEMBER";
      globalRole: "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "MEMBER";
      projectId: string;
      // 현재 계정으로 접근할 수 있는 프로젝트가 하나라도 있는지(배정이 모두 해제되면 false → 로그인 화면으로)
      projectAccess: boolean;
      jobTitle: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    loginId?: string;
    role?: "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "MEMBER";
    projectId?: string;
  }
}
