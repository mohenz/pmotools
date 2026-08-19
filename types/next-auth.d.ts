import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    loginId: string;
    role: "ADMIN" | "OPERATOR" | "MEMBER";
    projectId: string;
  }

  interface Session {
    user: {
      id: string;
      loginId: string;
      role: "ADMIN" | "OPERATOR" | "MEMBER";
      projectId: string;
      jobTitle: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    loginId?: string;
    role?: "ADMIN" | "OPERATOR" | "MEMBER";
    projectId?: string;
  }
}
