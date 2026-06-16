import type { Locale, ModeId, ModeStats, PlayerCamp } from "@/src/core/types";

export interface StoredUserState {
  lang?: Locale;
  camp?: PlayerCamp | null;
  totalXp?: number;
  stats?: Partial<Record<ModeId, ModeStats>>;
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

function mergeStats(local: ModeStats, remote: ModeStats): ModeStats {
  const dist = { ...remote.dist };
  for (const [attempts, count] of Object.entries(local.dist)) {
    dist[attempts] = Math.max(dist[attempts] ?? 0, count);
  }

  return {
    played: Math.max(local.played, remote.played),
    won: Math.max(local.won, remote.won),
    streak: Math.max(local.streak, remote.streak),
    maxStreak: Math.max(local.maxStreak, remote.maxStreak),
    lastWonPuzzle: Math.max(local.lastWonPuzzle, remote.lastWonPuzzle),
    dist,
  };
}

const ALL_MODES: ModeId[] = ["classic", "quote", "map"];

export function parseUserState(raw: string): StoredUserState {
  try {
    return JSON.parse(raw) as StoredUserState;
  } catch {
    return {};
  }
}

export function mergeUserState(left: StoredUserState, right: StoredUserState): StoredUserState {
  const stats: Partial<Record<ModeId, ModeStats>> = {};
  for (const mode of ALL_MODES) {
    const a = left.stats?.[mode] ?? emptyStats();
    const b = right.stats?.[mode] ?? emptyStats();
    if (left.stats?.[mode] || right.stats?.[mode]) {
      stats[mode] = mergeStats(a, b);
    }
  }

  return {
    lang: right.lang ?? left.lang,
    camp: right.camp ?? left.camp ?? null,
    totalXp: Math.max(left.totalXp ?? 0, right.totalXp ?? 0),
    stats,
  };
}

export function serializeUserState(state: StoredUserState): string {
  return JSON.stringify(state);
}
