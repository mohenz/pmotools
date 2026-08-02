import "server-only";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as { projectToolPool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  const sslMode = process.env.DATABASE_SSL ?? (process.env.NODE_ENV === "production" ? "require" : "disable");
  const poolMax = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "8", 10);
  const connectionTimeoutMillis = Number.parseInt(process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? "10000", 10);
  const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, "\n");
  const ssl = sslMode === "disable" ? undefined : {
    rejectUnauthorized: sslMode === "verify-full",
    ...(ca ? { ca } : {}),
  };

  return new Pool({
    connectionString,
    ssl,
    max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 8,
    connectionTimeoutMillis: Number.isFinite(connectionTimeoutMillis) && connectionTimeoutMillis > 0 ? connectionTimeoutMillis : 10_000,
    idleTimeoutMillis: 10_000,
  });
}

function getPool() {
  if (!globalForDb.projectToolPool) {
    globalForDb.projectToolPool = createPool();
  }

  return globalForDb.projectToolPool;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values);
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
