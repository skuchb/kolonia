import { and, eq } from "drizzle-orm";
import type { ModeId } from "@/src/core/types";
import { getDb } from "./index";
import {
  contentNpcs,
  contentQuotes,
  dailyPuzzles,
  mapPuzzles,
  maps,
} from "./schema";
import { readCmsFallback, resolveCmsFallback, writeCmsFallback, isNodeRuntime } from "./cms-fallback-io";
import type { CmsFallbackState } from "./cms-snapshot";
import { cmsSnapshotEmpty } from "./cms-snapshot";

function now() {
  return Date.now();
}

async function withFallback<T>(dbFn: () => Promise<T>, fallbackFn: () => T): Promise<T> {
  try {
    getDb();
    return await dbFn();
  } catch {
    return fallbackFn();
  }
}

export async function upsertDailyPuzzle(input: {
  puzzle: number;
  mode: ModeId;
  npcId?: string | null;
  quoteId?: string | null;
  mapPuzzleId?: number | null;
  published?: number;
}) {
  const ts = now();
  return withFallback(
    async () => {
      const db = getDb();
      const [existing] = await db
        .select()
        .from(dailyPuzzles)
        .where(and(eq(dailyPuzzles.puzzle, input.puzzle), eq(dailyPuzzles.mode, input.mode)))
        .limit(1);

      if (existing) {
        await db
          .update(dailyPuzzles)
          .set({
            npcId: input.npcId ?? null,
            quoteId: input.quoteId ?? null,
            mapPuzzleId: input.mapPuzzleId ?? null,
            published: input.published ?? 1,
            updatedAt: ts,
          })
          .where(eq(dailyPuzzles.id, existing.id));
        return existing.id;
      }

      const inserted = await db
        .insert(dailyPuzzles)
        .values({
          puzzle: input.puzzle,
          mode: input.mode,
          npcId: input.npcId ?? null,
          quoteId: input.quoteId ?? null,
          mapPuzzleId: input.mapPuzzleId ?? null,
          published: input.published ?? 1,
          createdAt: ts,
          updatedAt: ts,
        })
        .returning({ id: dailyPuzzles.id });
      return inserted[0]?.id ?? 0;
    },
    () => {
      if (!isNodeRuntime()) throw new Error("CMS fallback write unavailable");
      const state = readCmsFallback();
      const index = state.dailyPuzzles.findIndex(
        (row) => row.puzzle === input.puzzle && row.mode === input.mode,
      );
      const next = {
        puzzle: input.puzzle,
        mode: input.mode,
        npcId: input.npcId ?? null,
        quoteId: input.quoteId ?? null,
        mapPuzzleId: input.mapPuzzleId ?? null,
        published: input.published ?? 1,
      };
      if (index >= 0) state.dailyPuzzles[index] = next;
      else state.dailyPuzzles.push(next);
      writeCmsFallback(state);
      return index >= 0 ? index + 1 : state.dailyPuzzles.length;
    },
  );
}

export async function setNpcEnabled(id: string, enabled: boolean) {
  const ts = now();
  return withFallback(
    async () => {
      const db = getDb();
      await db.update(contentNpcs).set({ enabled: enabled ? 1 : 0, updatedAt: ts }).where(eq(contentNpcs.id, id));
    },
    () => {
      const state = readCmsFallback();
      const row = state.npcs.find((entry) => entry.id === id);
      if (!row) throw new Error("npc_not_found");
      row.enabled = enabled ? 1 : 0;
      row.updatedAt = ts;
      writeCmsFallback(state);
    },
  );
}

export async function setQuoteEnabled(id: string, enabled: boolean) {
  const ts = now();
  return withFallback(
    async () => {
      const db = getDb();
      await db
        .update(contentQuotes)
        .set({ enabled: enabled ? 1 : 0, updatedAt: ts })
        .where(eq(contentQuotes.id, id));
    },
    () => {
      const state = readCmsFallback();
      const row = state.quotes.find((entry) => entry.id === id);
      if (!row) throw new Error("quote_not_found");
      row.enabled = enabled ? 1 : 0;
      row.updatedAt = ts;
      writeCmsFallback(state);
    },
  );
}

export async function upsertMapPuzzle(input: {
  id?: number;
  mapId: string;
  npcId: string;
  x: number;
  y: number;
  toleranceMeters?: number | null;
  chapterPl?: string | null;
  chapterEn?: string | null;
  chapterDe?: string | null;
  label?: string | null;
}) {
  const ts = now();
  return withFallback(
    async () => {
      const db = getDb();
      if (input.id) {
        await db
          .update(mapPuzzles)
          .set({
            mapId: input.mapId,
            npcId: input.npcId,
            x: input.x,
            y: input.y,
            toleranceMeters: input.toleranceMeters ?? null,
            chapterPl: input.chapterPl ?? null,
            chapterEn: input.chapterEn ?? null,
            chapterDe: input.chapterDe ?? null,
            label: input.label ?? null,
          })
          .where(eq(mapPuzzles.id, input.id));
        return input.id;
      }

      const inserted = await db
        .insert(mapPuzzles)
        .values({
          mapId: input.mapId,
          npcId: input.npcId,
          x: input.x,
          y: input.y,
          toleranceMeters: input.toleranceMeters ?? null,
          chapterPl: input.chapterPl ?? null,
          chapterEn: input.chapterEn ?? null,
          chapterDe: input.chapterDe ?? null,
          label: input.label ?? null,
          createdAt: ts,
        })
        .returning({ id: mapPuzzles.id });
      return inserted[0]?.id ?? 0;
    },
    () => {
      const state = readCmsFallback();
      if (input.id) {
        const row = state.mapPuzzles.find((entry) => entry.id === input.id);
        if (!row) throw new Error("map_puzzle_not_found");
        Object.assign(row, input);
        writeCmsFallback(state);
        return input.id;
      }
      const nextId = Math.max(0, ...state.mapPuzzles.map((entry) => entry.id)) + 1;
      state.mapPuzzles.push({
        id: nextId,
        mapId: input.mapId,
        npcId: input.npcId,
        x: input.x,
        y: input.y,
        toleranceMeters: input.toleranceMeters ?? null,
        chapterPl: input.chapterPl ?? null,
        chapterEn: input.chapterEn ?? null,
        chapterDe: input.chapterDe ?? null,
        label: input.label ?? null,
        createdAt: ts,
      });
      writeCmsFallback(state);
      return nextId;
    },
  );
}

export async function listAdminSnapshot(): Promise<CmsFallbackState> {
  try {
    const db = getDb();
    const [npcRows, quoteRows, mapRows, mapPuzzleRows, scheduleRows] = await Promise.all([
      db.select().from(contentNpcs),
      db.select().from(contentQuotes),
      db.select().from(maps),
      db.select().from(mapPuzzles),
      db.select().from(dailyPuzzles),
    ]);

    const snapshot: CmsFallbackState = {
      npcs: npcRows.map((row) => ({
        id: row.id,
        dataJson: row.dataJson,
        enabled: row.enabled,
        adminNote: row.adminNote,
        updatedAt: row.updatedAt,
      })),
      quotes: quoteRows.map((row) => ({
        id: row.id,
        npcId: row.npcId,
        dataJson: row.dataJson,
        enabled: row.enabled,
        qualityStatus: row.qualityStatus,
        adminNote: row.adminNote,
        updatedAt: row.updatedAt,
      })),
      maps: mapRows.map((row) => ({
        id: row.id,
        name: row.name,
        imageUrl: row.imageUrl,
        imageWidth: row.imageWidth,
        imageHeight: row.imageHeight,
        metersPerPixel: row.metersPerPixel,
        defaultToleranceMeters: row.defaultToleranceMeters,
        active: row.active,
        updatedAt: row.updatedAt,
      })),
      mapPuzzles: mapPuzzleRows.map((row) => ({
        id: row.id,
        mapId: row.mapId,
        npcId: row.npcId,
        x: row.x,
        y: row.y,
        toleranceMeters: row.toleranceMeters,
        chapterPl: row.chapterPl,
        chapterEn: row.chapterEn,
        chapterDe: row.chapterDe,
        label: row.label,
        createdAt: row.createdAt,
      })),
      dailyPuzzles: scheduleRows.map((row) => ({
        puzzle: row.puzzle,
        mode: row.mode,
        npcId: row.npcId,
        quoteId: row.quoteId,
        mapPuzzleId: row.mapPuzzleId,
        published: row.published,
      })),
    };

    if (cmsSnapshotEmpty(snapshot)) return resolveCmsFallback();
    return snapshot;
  } catch {
    return resolveCmsFallback();
  }
}
