import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data-src/cms-fallback.json"), "utf8"));
const sqlPath = join(root, "data-src/seed-d1.sql");
const persistTo = join(root, ".wrangler/state");
const wranglerConfig = join(root, "dist/server/wrangler.json");

function sqlText(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNullable(value) {
  return value == null || value === "" ? "NULL" : sqlText(value);
}

const lines = ["PRAGMA foreign_keys = OFF;"];

for (const npc of data.npcs) {
  lines.push(
    `INSERT OR REPLACE INTO content_npcs (id, data_json, enabled, admin_note, updated_at) VALUES (${sqlText(npc.id)}, ${sqlText(npc.dataJson)}, ${npc.enabled ?? 1}, ${sqlNullable(npc.adminNote)}, ${npc.updatedAt ?? Date.now()});`,
  );
}

for (const quote of data.quotes) {
  lines.push(
    `INSERT OR REPLACE INTO content_quotes (id, npc_id, data_json, enabled, quality_status, admin_note, updated_at) VALUES (${sqlText(quote.id)}, ${sqlText(quote.npcId)}, ${sqlText(quote.dataJson)}, ${quote.enabled ?? 1}, ${sqlText(quote.qualityStatus ?? "ok")}, ${sqlNullable(quote.adminNote)}, ${quote.updatedAt ?? Date.now()});`,
  );
}

for (const map of data.maps) {
  lines.push(
    `INSERT OR REPLACE INTO maps (id, name, image_url, image_width, image_height, meters_per_pixel, default_tolerance_meters, active, updated_at) VALUES (${sqlText(map.id)}, ${sqlText(map.name)}, ${sqlText(map.imageUrl)}, ${map.imageWidth}, ${map.imageHeight}, ${map.metersPerPixel}, ${map.defaultToleranceMeters}, ${map.active ?? 1}, ${map.updatedAt ?? Date.now()});`,
  );
}

for (const puzzle of data.mapPuzzles) {
  lines.push(
    `INSERT OR REPLACE INTO map_puzzles (id, map_id, npc_id, x, y, tolerance_meters, chapter_pl, chapter_en, chapter_de, label, created_at) VALUES (${puzzle.id}, ${sqlText(puzzle.mapId)}, ${sqlText(puzzle.npcId)}, ${puzzle.x}, ${puzzle.y}, ${puzzle.toleranceMeters ?? "NULL"}, ${sqlNullable(puzzle.chapterPl)}, ${sqlNullable(puzzle.chapterEn)}, ${sqlNullable(puzzle.chapterDe)}, ${sqlNullable(puzzle.label)}, ${puzzle.createdAt ?? Date.now()});`,
  );
}

for (const row of data.dailyPuzzles) {
  lines.push(
    `INSERT OR REPLACE INTO daily_puzzles (puzzle, mode, npc_id, quote_id, map_puzzle_id, published, created_at, updated_at) VALUES (${row.puzzle}, ${sqlText(row.mode)}, ${sqlNullable(row.npcId)}, ${sqlNullable(row.quoteId)}, ${row.mapPuzzleId ?? "NULL"}, ${row.published ?? 1}, ${Date.now()}, ${Date.now()});`,
  );
}

writeFileSync(sqlPath, lines.join("\n"), "utf8");
console.log(`seed-d1: wrote ${lines.length} statements to ${sqlPath}`);

const result = spawnSync(
  "npx",
  [
    "wrangler",
    "d1",
    "execute",
    "site-creator-d1",
    "--local",
    "--config",
    wranglerConfig,
    "--persist-to",
    persistTo,
    "--file",
    sqlPath,
  ],
  { cwd: root, stdio: "inherit", shell: true },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("seed-d1: import complete");
