import { NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID, FIRESTORE_DATABASE_ID, ensureFirestoreSeeded, projectRef } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureFirestoreSeeded(DEFAULT_PROJECT_ID);
    const project = await projectRef(DEFAULT_PROJECT_ID).get();
    if (!project.exists) throw new Error("Default project is unavailable.");
    return NextResponse.json({ status: "ok", database: "connected", provider: "firestore", databaseId: FIRESTORE_DATABASE_ID });
  } catch (error) {
    console.error("Firestore health check failed", error);
    return NextResponse.json({ status: "error", database: "unavailable", provider: "firestore" }, { status: 503 });
  }
}
