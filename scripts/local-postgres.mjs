// 로컬 PostgreSQL(포트 55432) 시작 · 중지 · 상태 — `npm run db:local:start | stop | status`
// PowerShell이 회사 정책으로 차단되어(2026-10-01) 기존 *-local-postgres.ps1과 같은 동작을 node로 옮겼다.
// pmotools와 백오피스(pmotools_admin)에 같은 내용으로 둔다. 백오피스는 자체 DB 폴더가 없어 pmotools의 로컬 DB를 함께 쓴다.
//
//   node scripts/local-postgres.mjs start    # 이미 실행 중이면 그대로 둔다
//   node scripts/local-postgres.mjs stop     # fast 모드 중지
//   node scripts/local-postgres.mjs status   # pg_isready 결과(0 = 접속 가능)
//
// PostgreSQL 설치 경로가 다르면 환경변수 PG_BIN으로 지정한다(기본: C:\Program Files\PostgreSQL\18\bin).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = "55432";
const PG_BIN = process.env.PG_BIN ?? "C:\\Program Files\\PostgreSQL\\18\\bin";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// 데이터 폴더: 이 저장소 → 없으면 옆 pmotools 저장소(백오피스가 공유 로컬 DB를 쓰는 경우)
const dataDir = [path.join(root, ".local-postgres", "data"), path.join(root, "..", "pmotools", ".local-postgres", "data")]
  .find((dir) => existsSync(path.join(dir, "PG_VERSION")));

const bin = (name) => path.join(PG_BIN, name);
const run = (name, args) => spawnSync(bin(name), args, { stdio: ["ignore", "inherit", "inherit"], windowsHide: true });
const isReady = () => spawnSync(bin("pg_isready.exe"), ["-h", "localhost", "-p", PORT], { stdio: "ignore", windowsHide: true }).status === 0;
const fail = (message) => { console.error(message); process.exit(1); };

if (!existsSync(bin("pg_ctl.exe"))) fail(`PostgreSQL 실행 파일을 찾을 수 없습니다: ${PG_BIN} (환경변수 PG_BIN으로 경로를 지정하십시오)`);

const command = process.argv[2];
if (command === "start") {
  if (isReady()) { console.log(`Local PostgreSQL is already running on port ${PORT}.`); process.exit(0); }
  if (!dataDir) fail("로컬 DB가 초기화되지 않았습니다. (.local-postgres/data 없음)");
  const result = run("pg_ctl.exe", ["-D", dataDir, "-l", path.join(dataDir, "..", "postgres.log"), "-o", `-p ${PORT}`, "-w", "start"]);
  if (result.status !== 0) fail("로컬 PostgreSQL을 시작하지 못했습니다. .local-postgres/postgres.log를 확인하십시오.");
  console.log(`Local PostgreSQL started on port ${PORT}. (data: ${dataDir})`);
} else if (command === "stop") {
  if (!dataDir || !existsSync(path.join(dataDir, "postmaster.pid"))) { console.log("Local PostgreSQL is not running."); process.exit(0); }
  const result = run("pg_ctl.exe", ["-D", dataDir, "stop", "-m", "fast"]);
  if (result.status !== 0) fail("로컬 PostgreSQL을 중지하지 못했습니다.");
} else if (command === "status") {
  process.exit(run("pg_isready.exe", ["-h", "localhost", "-p", PORT, "-d", "mydb"]).status ?? 1);
} else {
  fail("사용법: node scripts/local-postgres.mjs <start|stop|status>");
}
