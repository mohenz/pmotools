import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { listUsers } from "@/lib/server/admin";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  try {
    const q = request.nextUrl.searchParams.get("q") ?? undefined;
    return NextResponse.json({ data: await listUsers(projectId, userId, q) });
  } catch (error) { return mutationErrorResponse(error); }
}
