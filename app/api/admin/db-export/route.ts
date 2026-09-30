import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const DEFAULT_SYNC_TOKEN = "pmo-internal-sync-2026";

function isAuthorized(req: NextRequest): boolean {
  const token = req.nextUrl.searchParams.get("token") || req.headers.get("x-sync-token") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expectedToken = process.env.INTERNAL_SYNC_SECRET || process.env.SYNC_SECRET_TOKEN || DEFAULT_SYNC_TOKEN;

  if (!token || !expectedToken) return false;

  const tokenBuf = Buffer.from(token.trim());
  const expectedBuf = Buffer.from(expectedToken.trim());

  if (tokenBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(tokenBuf, expectedBuf);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized access: invalid token" }, { status: 401 });
  }

  // 1. Try pg_dump first
  const dbUrl = (process.env.DATABASE_URL || "").replace(/\?.*$/, "");
  const pgDumpCandidates = [
    "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe",
    "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe",
    "pg_dump"
  ];

  let pgDumpPath: string | null = null;
  for (const candidate of pgDumpCandidates) {
    if (candidate === "pg_dump" || fs.existsSync(candidate)) {
      pgDumpPath = candidate;
      break;
    }
  }

  if (dbUrl && pgDumpPath) {
    try {
      const dumpCommand = `"${pgDumpPath}" --dbname="${dbUrl}" --no-owner --no-privileges --clean --if-exists`;
      const stdout = execSync(dumpCommand, {
        maxBuffer: 100 * 1024 * 1024, // 100MB
        encoding: "utf-8",
        timeout: 60000,
      });

      if (stdout && stdout.length > 500) {
        return new Response(stdout, {
          status: 200,
          headers: {
            "Content-Type": "application/sql; charset=utf-8",
            "Content-Disposition": 'attachment; filename="central_dump.sql"',
            "X-Dump-Source": "pg_dump",
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Pragma": "no-cache",
          },
        });
      }
    } catch (dumpErr: any) {
      console.error("[db-export] pg_dump failed:", dumpErr?.message || dumpErr);
    }
  }

  // 2. Fallback: Check existing backup files in standard directories
  const searchDirs = [
    "d:\\product\\db_backups",
    "d:\\workspace\\pmotools\\.local-postgres",
    path.join(process.cwd(), ".local-postgres"),
  ];

  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs
          .readdirSync(dir)
          .filter((f) => f.endsWith(".sql"))
          .map((f) => ({
            file: path.join(dir, f),
            mtime: fs.statSync(path.join(dir, f)).mtimeMs,
          }))
          .sort((a, b) => b.mtime - a.mtime);

        if (files.length > 0) {
          const latestFile = files[0].file;
          const content = fs.readFileSync(latestFile, "utf-8");
          return new Response(content, {
            status: 200,
            headers: {
              "Content-Type": "application/sql; charset=utf-8",
              "Content-Disposition": `attachment; filename="${path.basename(latestFile)}"`,
              "X-Dump-Source": "backup_file",
              "X-Backup-Path": latestFile,
              "Cache-Control": "no-store, no-cache, must-revalidate",
              "Pragma": "no-cache",
            },
          });
        }
      } catch (fileErr) {
        console.error("[db-export] backup dir read error:", fileErr);
      }
    }
  }

  return NextResponse.json(
    {
      error: "Failed to generate or locate database dump on the server.",
      dbUrlPresent: !!dbUrl,
      pgDumpFound: !!pgDumpPath,
    },
    { status: 500 }
  );
}
