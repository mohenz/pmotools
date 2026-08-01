import { NextResponse } from "next/server";
import { query } from "@/lib/server/db";

export async function GET() {
  try {
    await query("select 1");
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch {
    return NextResponse.json({ status: "error", database: "unavailable" }, { status: 503 });
  }
}

