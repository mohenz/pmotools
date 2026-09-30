import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db-pg";

export async function GET() {
  const projects = await getPrisma().project.findMany({ select: { code: true, name: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ data: projects });
}
