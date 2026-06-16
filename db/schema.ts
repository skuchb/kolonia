import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  googleSub: text("google_sub").notNull().unique(),
  displayName: text("display_name").notNull(),
  camp: text("camp"),
  role: text("role").notNull().default("user"),
  stateJson: text("state").notNull().default("{}"),
  created: integer("created").notNull(),
});

export const results = sqliteTable(
  "results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id"),
    mode: text("mode").notNull(),
    puzzle: integer("puzzle").notNull(),
    attempts: integer("attempts").notNull(),
    solved: integer("solved").notNull(),
    points: integer("points").notNull(),
    camp: text("camp"),
    ipHash: text("ip_hash").notNull(),
    event: text("event").notNull().default("solve"),
    ts: integer("ts").notNull(),
  },
  (table) => [
    uniqueIndex("uq_mode_puzzle_ip_event").on(table.mode, table.puzzle, table.ipHash, table.event),
  ],
);

export const contentNpcs = sqliteTable("content_npcs", {
  id: text("id").primaryKey(),
  dataJson: text("data_json").notNull(),
  enabled: integer("enabled").notNull().default(1),
  adminNote: text("admin_note"),
  updatedAt: integer("updated_at").notNull(),
});

export const contentQuotes = sqliteTable("content_quotes", {
  id: text("id").primaryKey(),
  npcId: text("npc_id").notNull(),
  dataJson: text("data_json").notNull(),
  enabled: integer("enabled").notNull().default(1),
  qualityStatus: text("quality_status").notNull().default("ok"),
  adminNote: text("admin_note"),
  updatedAt: integer("updated_at").notNull(),
});

export const maps = sqliteTable("maps", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  imageWidth: integer("image_width").notNull(),
  imageHeight: integer("image_height").notNull(),
  metersPerPixel: real("meters_per_pixel").notNull().default(2.5),
  defaultToleranceMeters: real("default_tolerance_meters").notNull().default(80),
  active: integer("active").notNull().default(1),
  updatedAt: integer("updated_at").notNull(),
});

export const mapPuzzles = sqliteTable("map_puzzles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mapId: text("map_id").notNull(),
  npcId: text("npc_id").notNull(),
  x: real("x").notNull(),
  y: real("y").notNull(),
  toleranceMeters: real("tolerance_meters"),
  chapterPl: text("chapter_pl"),
  chapterEn: text("chapter_en"),
  chapterDe: text("chapter_de"),
  label: text("label"),
  createdAt: integer("created_at").notNull(),
});

export const dailyPuzzles = sqliteTable(
  "daily_puzzles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    puzzle: integer("puzzle").notNull(),
    mode: text("mode").notNull(),
    npcId: text("npc_id"),
    quoteId: text("quote_id"),
    mapPuzzleId: integer("map_puzzle_id"),
    published: integer("published").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("uq_daily_puzzle_mode_day").on(table.puzzle, table.mode)],
);

export const userProgress = sqliteTable("user_progress", {
  userId: text("user_id").primaryKey(),
  totalXp: integer("total_xp").notNull().default(0),
  progressJson: text("progress_json").notNull().default("{}"),
  updatedAt: integer("updated_at").notNull(),
});

export const userSolves = sqliteTable(
  "user_solves",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id"),
    mode: text("mode").notNull(),
    puzzle: integer("puzzle").notNull(),
    attempts: integer("attempts").notNull(),
    xpEarned: integer("xp_earned").notNull(),
    distanceMeters: real("distance_meters"),
    solvedAt: integer("solved_at").notNull(),
  },
  (table) => [uniqueIndex("uq_user_solve").on(table.userId, table.mode, table.puzzle)],
);

export const adminAuditLog = sqliteTable("admin_audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  detailsJson: text("details_json"),
  ts: integer("ts").notNull(),
});
