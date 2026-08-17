import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { listMenuPreferences, updateMenuPreferences } from "@/lib/server/menu-preferences";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET() {
  const { projectId } = await getLocalContext();
  return NextResponse.json({ data: await listMenuPreferences(projectId) });
}

export async function PATCH(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  try {
    const data = await updateMenuPreferences(projectId, userId, await request.json());
    return NextResponse.json({ data });
  } catch (error) { return mutationErrorResponse(error); }
}
