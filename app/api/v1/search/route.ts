import { NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { searchAll } from "@/lib/server/search";

export async function GET(request: Request) {
  const { projectId } = await getLocalContext();
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ data: { query, groups: [] } });
  const groups = await searchAll(projectId, query, 5);
  return NextResponse.json({ data: { query, groups } });
}
