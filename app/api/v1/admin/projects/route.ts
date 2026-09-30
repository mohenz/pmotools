import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { createProject, listProjects } from "@/lib/server/projects-admin";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET() {
  return NextResponse.json({ data: await listProjects() });
}

export async function POST(request: NextRequest) {
  const { userId } = await getLocalContext();
  try {
    const project = await createProject(userId, await request.json());
    return NextResponse.json({ data: project }, { status: 201 });
  } catch (error) { return mutationErrorResponse(error); }
}
