import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db-pg";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json({ error: "CRON_SECRET is not configured on the server." }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { jobName, status, output, durationMs } = body;

    if (!jobName || !status) {
      return NextResponse.json({ error: "Missing required fields: jobName, status" }, { status: 400 });
    }

    const prisma = getPrisma();

    const log = await prisma.batchJobLog.create({
      data: {
        jobName,
        status,
        output: output ?? null,
        durationMs: durationMs ?? null,
      },
    });

    return NextResponse.json({ success: true, data: log });
  } catch (error) {
    console.error("[Batch API Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
