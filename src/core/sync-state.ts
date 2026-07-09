import { puzzleNumber } from "./daily";
import type { MapGuess, ModeDay, ModeId, ModeStats, Persisted } from "./types";
import type { ManhuntState, ManhuntStats } from "@/src/modes/manhunt/types";
import { MANHUNT_CONFIG } from "@/src/modes/manhunt/config";
import { exportManhuntBundle, importManhuntBundle } from "@/src/modes/manhunt/state";

const ALL_MODES: ModeId[] = ["manhunt", "classic", "quote", "map", "card"];

function mergeMapGuesses(left?: MapGuess[], right?: MapGuess[]): MapGuess[] | undefined {
  const combined = [...(left ?? []), ...(right ?? [])];
  if (combined.length === 0) return undefined;

  const seen = new Set<string>();
  const merged: MapGuess[] = [];
  for (const guess of combined) {
    const key = `${guess.x.toFixed(4)}:${guess.y.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(guess);
  }
  return merged;
}

export function mergeModeDay(left?: ModeDay, right?: ModeDay): ModeDay | undefined {
  if (!left) return right;
  if (!right) return left;
  if (left.puzzle !== right.puzzle) {
    return left.puzzle > right.puzzle ? left : right;
  }

  return {
    puzzle: left.puzzle,
    solved: left.solved || right.solved,
    guesses: [...new Set([...left.guesses, ...right.guesses])],
    mapGuesses: mergeMapGuesses(left.mapGuesses, right.mapGuesses),
    cardTiles: [...new Set([...(left.cardTiles ?? []), ...(right.cardTiles ?? [])])],
  };
}

export function mergeModeStats(left: ModeStats, right: ModeStats): ModeStats {
  const dist = { ...right.dist };
  for (const [attempts, count] of Object.entries(left.dist)) {
    dist[attempts] = Math.max(dist[attempts] ?? 0, count);
  }

  return {
    played: Math.max(left.played, right.played),
    won: Math.max(left.won, right.won),
    streak: Math.max(left.streak, right.streak),
    maxStreak: Math.max(left.maxStreak, right.maxStreak),
    lastWonPuzzle: Math.max(left.lastWonPuzzle, right.lastWonPuzzle),
    dist,
  };
}

export function mergeManhuntStats(left: ManhuntStats, right: ManhuntStats): ManhuntStats {
  const dist = { ...right.dist };
  for (const [attempts, count] of Object.entries(left.dist)) {
    dist[attempts] = Math.max(dist[attempts] ?? 0, count);
  }

  return {
    played: Math.max(left.played, right.played),
    won: Math.max(left.won, right.won),
    streak: Math.max(left.streak, right.streak),
    maxStreak: Math.max(left.maxStreak, right.maxStreak),
    lastWonDay: Math.max(left.lastWonDay, right.lastWonDay),
    bestScore: Math.max(left.bestScore, right.bestScore),
    totalScore: Math.max(left.totalScore, right.totalScore),
    dist,
  };
}

function manhuntProgressScore(state: ManhuntState): number {
  const spent = MANHUNT_CONFIG.budget - state.nuggets;
  return state.revealCount * 10 + state.misses.length * 5 + spent + (state.status === "won" ? 1000 : 0);
}

export function mergeManhuntState(left: ManhuntState, right: ManhuntState): ManhuntState {
  const day = left.day;
  if (left.status === "won" && right.status === "won") {
    return left.nuggets >= right.nuggets ? left : right;
  }
  if (left.status === "won") return left;
  if (right.status === "won") return right;

  const preferred = manhuntProgressScore(left) >= manhuntProgressScore(right) ? left : right;
  const other = preferred === left ? right : left;

  return {
    ...preferred,
    day,
    revealed: Array.from(new Set([...preferred.revealed, ...other.revealed])),
    misses: [...new Set([...preferred.misses, ...other.misses])],
    nuggets: Math.min(preferred.nuggets, other.nuggets),
    revealCount: Math.max(preferred.revealCount, other.revealCount),
  };
}

export function mergeModes(
  left: Persisted["modes"],
  right: Persisted["modes"],
  today = puzzleNumber(),
): Persisted["modes"] {
  const merged: Persisted["modes"] = { ...left };

  for (const mode of ALL_MODES) {
    const localDay = left[mode];
    const remoteDay = right[mode];
    if (!remoteDay) continue;

    if (!localDay) {
      if (remoteDay.puzzle === today) merged[mode] = remoteDay;
      continue;
    }

    if (localDay.puzzle === remoteDay.puzzle) {
      const next = mergeModeDay(localDay, remoteDay);
      if (next) merged[mode] = next;
      continue;
    }

    if (remoteDay.puzzle === today) {
      merged[mode] = remoteDay;
    }
  }

  return merged;
}

export function mergeArchive(
  left: Persisted["archive"],
  right: Persisted["archive"],
): Persisted["archive"] {
  const merged: NonNullable<Persisted["archive"]> = { ...(left ?? {}) };

  for (const mode of ALL_MODES) {
    const localDays = left?.[mode] ?? {};
    const remoteDays = right?.[mode] ?? {};
    const keys = new Set([...Object.keys(localDays), ...Object.keys(remoteDays)]);
    if (keys.size === 0) continue;

    const nextModeDays: Record<string, ModeDay> = {};
    for (const key of keys) {
      const next = mergeModeDay(localDays[key], remoteDays[key]);
      if (next) nextModeDays[key] = next;
    }
    merged[mode] = nextModeDays;
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function mergeManhuntDays(
  left: Record<string, ManhuntState>,
  right: Record<string, ManhuntState>,
): Record<string, ManhuntState> {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const merged: Record<string, ManhuntState> = {};

  for (const key of keys) {
    const local = left[key];
    const remote = right[key];
    if (local && remote) {
      merged[key] = mergeManhuntState(local, remote);
    } else if (local || remote) {
      merged[key] = (local ?? remote)!;
    }
  }

  return merged;
}

export interface RemoteGameState {
  modes?: Persisted["modes"];
  archive?: Persisted["archive"];
  manhuntDays?: Record<string, ManhuntState>;
  manhuntStats?: ManhuntStats;
  stats?: Persisted["stats"];
  totalXp?: number;
  camp?: Persisted["camp"];
  lang?: Persisted["lang"];
  emailOptIn?: Persisted["emailOptIn"];
}

export function mergePersistedWithRemote(local: Persisted, remote: RemoteGameState): Persisted {
  const stats = { ...local.stats };
  for (const mode of ALL_MODES) {
    const localStats = local.stats[mode];
    const remoteStats = remote.stats?.[mode];
    if (localStats && remoteStats) {
      stats[mode] = mergeModeStats(localStats, remoteStats);
    } else if (remoteStats) {
      stats[mode] = remoteStats;
    }
  }

  return {
    ...local,
    lang: remote.lang ?? local.lang,
    camp: remote.camp ?? local.camp,
    emailOptIn: remote.emailOptIn ?? local.emailOptIn,
    totalXp: Math.max(local.totalXp ?? 0, remote.totalXp ?? 0),
    stats,
    modes: mergeModes(local.modes, remote.modes ?? {}),
    archive: mergeArchive(local.archive, remote.archive),
  };
}

export function buildRemoteGameState(state: Persisted): RemoteGameState {
  const manhunt = exportManhuntBundle();
  return {
    lang: state.lang,
    emailOptIn: state.emailOptIn,
    camp: state.camp,
    totalXp: state.totalXp ?? 0,
    stats: state.stats,
    modes: state.modes,
    archive: state.archive,
    manhuntDays: manhunt.days,
    manhuntStats: manhunt.stats,
  };
}

export function applyRemoteGameState(local: Persisted, remote: RemoteGameState): Persisted {
  const merged = mergePersistedWithRemote(local, remote);
  if (remote.manhuntDays || remote.manhuntStats) {
    importManhuntBundle({
      days: remote.manhuntDays ?? {},
      stats: remote.manhuntStats,
    });
  }
  return merged;
}
