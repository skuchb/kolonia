import { and, eq } from "drizzle-orm";
import type { ModeId, Npc, Quote, LocalizedText } from "@/src/core/types";
import { getDb } from "./index";
import {
  dailyPuzzles,
  mapPuzzles,
  maps,
  type maps as MapsTable,
} from "./schema";
import cmsFallback from "../data-src/cms-fallback.json";
import { readCmsFallback } from "./cms-fallback-io";
import type { CmsFallbackState } from "./cms-snapshot";
import { cmsSnapshotEmpty } from "./cms-snapshot";
import { listAdminSnapshot } from "./cms-write";

export type { CmsFallbackState } from "./cms-snapshot";

function fallbackState(): CmsFallbackState {
  return cmsFallback as CmsFallbackState;
}

export function parseNpcJson(raw: string): Npc {
  return JSON.parse(raw) as Npc;
}

export function parseQuoteJson(raw: string): Quote {
  return JSON.parse(raw) as Quote;
}

async function contentSnapshot(): Promise<CmsFallbackState> {
  try {
    const snapshot = await listAdminSnapshot();
    if (!cmsSnapshotEmpty(snapshot)) return snapshot;
  } catch {
    // fall through
  }
  return readCmsFallback();
}

export async function listContentNpcs(enabledOnly = false): Promise<Npc[]> {
  return contentSnapshot()
    .then((snapshot) =>
      snapshot.npcs
        .filter((row) => !enabledOnly || row.enabled === 1)
        .map((row) => parseNpcJson(row.dataJson)),
    );
}

export async function listContentQuotes(enabledOnly = false): Promise<Quote[]> {
  return contentSnapshot()
    .then((snapshot) =>
      snapshot.quotes
        .filter((row) => !enabledOnly || row.enabled === 1)
        .map((row) => parseQuoteJson(row.dataJson)),
    );
}

export async function getDailyScheduleRow(puzzle: number, mode: ModeId) {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(dailyPuzzles)
      .where(and(eq(dailyPuzzles.puzzle, puzzle), eq(dailyPuzzles.mode, mode)))
      .limit(1);
    if (row && row.published === 1) return row;
  } catch {
    // fall through to fallback
  }

  {
    const row = fallbackState().dailyPuzzles.find(
      (entry) => entry.puzzle === puzzle && entry.mode === mode && entry.published === 1,
    );
    return row ?? null;
  }
}

export async function getMapById(mapId: string) {
  try {
    const db = getDb();
    const [row] = await db.select().from(maps).where(eq(maps.id, mapId)).limit(1);
    if (row) return row;
  } catch {
    // fall through
  }
  return fallbackState().maps.find((row) => row.id === mapId) ?? null;
}

export async function getMapPuzzleById(id: number) {
  try {
    const db = getDb();
    const [row] = await db.select().from(mapPuzzles).where(eq(mapPuzzles.id, id)).limit(1);
    if (row) return row;
  } catch {
    // fall through
  }
  return fallbackState().mapPuzzles.find((row) => row.id === id) ?? null;
}

export function chapterFromMapPuzzle(row: {
  chapterPl?: string | null;
  chapterEn?: string | null;
  chapterDe?: string | null;
}): LocalizedText | null {
  if (!row.chapterPl && !row.chapterEn && !row.chapterDe) return null;
  return {
    pl: row.chapterPl ?? "",
    en: row.chapterEn ?? "",
    de: row.chapterDe ?? "",
  };
}

export type MapRow = typeof MapsTable.$inferSelect;
