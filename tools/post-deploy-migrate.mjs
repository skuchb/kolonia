import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DB_NAME = "kolonia-db";
const drizzleDir = join(root, "drizzle");

const remote = process.argv.includes("--remote");

const BENIGN_ERROR = /already exists|duplicate column|no such index/i;

function wranglerExecute(extraArgs) {
  const remoteFlags = remote
    ? "--remote"
    : `--local --config "${join(root, "wrangler.jsonc")}" --persist-to "${join(root, ".wrangler/state")}"`;

  let extra = "";
  for (let i = 0; i < extraArgs.length; i++) {
    const arg = extraArgs[i];
    if (arg === "--command" || arg === "--file") {
      const value = extraArgs[++i];
      extra += ` ${arg} "${String(value).replace(/"/g, '\\"')}"`;
    } else {
      extra += ` ${arg}`;
    }
  }

  const cmd = `npx wrangler d1 execute ${DB_NAME} ${remoteFlags} --json -y${extra}`;
  return spawnSync(cmd, { cwd: root, encoding: "utf8", shell: true });
}

function wranglerOutput(result) {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function parseWranglerJson(stdout) {
  if (!stdout?.trim()) return null;
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function extractRows(json) {
  if (!Array.isArray(json)) return [];
  const rows = [];
  for (const batch of json) {
    for (const result of batch.results ?? []) {
      if (result?.id !== undefined) rows.push(result);
      else if (Array.isArray(result?.results)) rows.push(...result.results);
    }
  }
  return rows;
}

function isExecuteSuccess(result) {
  if (result.status === 0) return true;
  return BENIGN_ERROR.test(wranglerOutput(result));
}

function listMigrationFiles() {
  return readdirSync(drizzleDir)
    .filter((name) => /^\d+_.*\.sql$/.test(name))
    .sort()
    .map((name) => join(drizzleDir, name));
}

function ensureSchemaMigrationsTable() {
  const sql =
    "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY NOT NULL, applied_at INTEGER NOT NULL);";
  const result = wranglerExecute(["--command", sql]);
  if (!isExecuteSuccess(result)) {
    console.error("post-deploy-migrate: failed to ensure schema_migrations table");
    console.error(wranglerOutput(result));
    process.exit(result.status ?? 1);
  }
}

function getAppliedMigrationIds() {
  const result = wranglerExecute(["--command", "SELECT id FROM schema_migrations;"]);
  if (!isExecuteSuccess(result)) {
    console.error("post-deploy-migrate: failed to read schema_migrations");
    console.error(wranglerOutput(result));
    process.exit(result.status ?? 1);
  }
  const rows = extractRows(parseWranglerJson(result.stdout));
  return new Set(rows.map((row) => row.id).filter(Boolean));
}

function recordMigration(id) {
  const safeId = id.replace(/'/g, "''");
  const sql = `INSERT OR IGNORE INTO schema_migrations (id, applied_at) VALUES ('${safeId}', ${Date.now()});`;
  const result = wranglerExecute(["--command", sql]);
  if (!isExecuteSuccess(result)) {
    console.error(`post-deploy-migrate: failed to record migration ${id}`);
    console.error(wranglerOutput(result));
    process.exit(result.status ?? 1);
  }
}

function applyMigration(filePath) {
  const result = wranglerExecute(["--file", filePath]);
  if (!isExecuteSuccess(result)) {
    console.error(`post-deploy-migrate: migration failed for ${basename(filePath)}`);
    console.error(wranglerOutput(result));
    process.exit(result.status ?? 1);
  }
}

console.log(`post-deploy-migrate: ${remote ? "remote" : "local"} D1 migrations`);

ensureSchemaMigrationsTable();
const applied = getAppliedMigrationIds();

for (const filePath of listMigrationFiles()) {
  const id = basename(filePath, ".sql");
  if (applied.has(id)) {
    console.log(`post-deploy-migrate: skip ${id}`);
    continue;
  }
  console.log(`post-deploy-migrate: applying ${id}`);
  applyMigration(filePath);
  recordMigration(id);
  console.log(`post-deploy-migrate: applied ${id}`);
}

console.log("post-deploy-migrate: complete");
