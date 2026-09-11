import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db-pg";
import { DEFAULT_PROJECT_ID } from "@/lib/domain/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const project = await getPrisma().project.findUnique({ where: { id: DEFAULT_PROJECT_ID } });
    if (!project) throw new Error("Default project is unavailable.");
    return NextResponse.json({ status: "ok", database: "connected", provider: "postgres" });
  } catch (error) {
    console.error("Postgres health check failed", error);
    return NextResponse.json({ status: "error", database: "unavailable", provider: "postgres" }, { status: 503 });
  }
}
