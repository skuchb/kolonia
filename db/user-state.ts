import type { Locale, ModeDay, ModeId, ModeStats, PlayerCamp } from "@/src/core/types";
import type { ManhuntState, ManhuntStats } from "@/src/modes/manhunt/types";
import {
  mergeArchive,
  mergeManhuntDays,
  mergeManhuntStats,
  mergeModeStats,
  mergeModes,
} from "@/src/core/sync-state";

export interface StoredUserState {
  lang?: Locale;
  camp?: PlayerCamp | null;
  totalXp?: number;
  stats?: Partial<Record<ModeId, ModeStats>>;
  modes?: Partial<Record<ModeId, ModeDay>>;
  archive?: Partial<Record<ModeId, Record<string, ModeDay>>>;
  manhuntDays?: Record<string, ManhuntState>;
  manhuntStats?: ManhuntStats;
}

function emptyStats(): ModeStats {
  return {
    played: 0,
    won: 0,
    streak: 0,
    maxStreak: 0,
    lastWonPuzzle: -1,
    dist: {},
  };
}

function emptyManhuntStats(): ManhuntStats {
  return {
    played: 0,
    won: 0,
    streak: 0,
    maxStreak: 0,
    lastWonDay: -1,
    bestScore: 0,
    totalScore: 0,
    dist: {},
  };
}

const ALL_MODES: ModeId[] = ["manhunt", "classic", "quote", "map", "card"];

export function parseUserState(raw: string): StoredUserState {
  try {
    return JSON.parse(raw) as StoredUserState;
  } catch {
    return {};
  }
}

export function readAccountStreak(state: StoredUserState): { streak: number; maxStreak: number } {
  const manhunt = state.manhuntStats;
  const mode = state.stats?.manhunt;
  const streak = Math.max(manhunt?.streak ?? 0, mode?.streak ?? 0);
  const maxStreak = Math.max(manhunt?.maxStreak ?? 0, mode?.maxStreak ?? 0, streak);
  return { streak, maxStreak };
}

export function mergeUserState(left: StoredUserState, right: StoredUserState): StoredUserState {
  const stats: Partial<Record<ModeId, ModeStats>> = {};
  for (const mode of ALL_MODES) {
    const a = left.stats?.[mode] ?? emptyStats();
    const b = right.stats?.[mode] ?? emptyStats();
    if (left.stats?.[mode] || right.stats?.[mode]) {
      stats[mode] = mergeModeStats(a, b);
    }
  }

  return {
    lang: right.lang ?? left.lang,
    camp: right.camp ?? left.camp ?? null,
    totalXp: Math.max(left.totalXp ?? 0, right.totalXp ?? 0),
    stats,
    modes: mergeModes(left.modes ?? {}, right.modes ?? {}),
    archive: mergeArchive(left.archive, right.archive),
    manhuntDays: mergeManhuntDays(left.manhuntDays ?? {}, right.manhuntDays ?? {}),
    manhuntStats:
      left.manhuntStats || right.manhuntStats
        ? mergeManhuntStats(left.manhuntStats ?? emptyManhuntStats(), right.manhuntStats ?? emptyManhuntStats())
        : undefined,
  };
}

export function serializeUserState(state: StoredUserState): string {
  return JSON.stringify(state);
}
