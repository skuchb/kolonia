import { puzzleNumber } from "@/src/core/daily";
import { MANHUNT_CONFIG } from "./config";
import { MANHUNT_HELP_KEY, type ManhuntFieldId, ManhuntState, ManhuntStats } from "./types";
import { xpForManhunt } from "./xp";

export type ManhuntWinSnapshot = {
  score: number;
  xpEarned: number;
  reveals: number;
  misses: number;
};

export const MANHUNT_STORAGE_KEY = "kolonia.manhunt.v1";
export const MANHUNT_DAYS_KEY = "kolonia.manhunt.days.v1";
export const MANHUNT_STATS_KEY = "kolonia.manhunt.stats.v1";

const ALL_PAID_FIELDS = MANHUNT_CONFIG.fields.map((field) => field.id);

function emptyStats(): ManhuntStats {
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

export function freshManhuntState(day: number): ManhuntState {
  return {
    day,
    nuggets: MANHUNT_CONFIG.budget,
    revealed: [...MANHUNT_CONFIG.freeFields],
    misses: [],
    status: "playing",
    revealCount: 0,
    startedAt: Date.now(),
  };
}

export function hasSeenManhuntHelp(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MANHUNT_HELP_KEY) === "1";
}

export function markManhuntHelpSeen() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MANHUNT_HELP_KEY, "1");
}

export function manhuntWinSnapshot(state: ManhuntState): ManhuntWinSnapshot | null {
  if (state.status !== "won") return null;
  const score = state.nuggets;
  return {
    score,
    xpEarned: xpForManhunt(score),
    reveals: state.revealCount,
    misses: state.misses.length,
  };
}

function readManhuntDays(): Record<string, ManhuntState> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(MANHUNT_DAYS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, ManhuntState>;

    const legacy = window.localStorage.getItem(MANHUNT_STORAGE_KEY);
    if (!legacy) return {};

    const parsed = JSON.parse(legacy) as ManhuntState;
    const map = { [String(parsed.day)]: parsed };
    window.localStorage.setItem(MANHUNT_DAYS_KEY, JSON.stringify(map));
    window.localStorage.removeItem(MANHUNT_STORAGE_KEY);
    return map;
  } catch {
    return {};
  }
}

function writeManhuntDays(days: Record<string, ManhuntState>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MANHUNT_DAYS_KEY, JSON.stringify(days));
}

function normalizeManhuntState(parsed: ManhuntState, day: number): ManhuntState {
  return {
    ...freshManhuntState(day),
    ...parsed,
    day,
    revealed: Array.from(new Set([...MANHUNT_CONFIG.freeFields, ...(parsed.revealed ?? [])])),
    misses: parsed.misses ?? [],
    revealCount: parsed.revealCount ?? 0,
    startedAt: parsed.startedAt ?? Date.now(),
  };
}

export function loadManhuntState(day = puzzleNumber()): ManhuntState {
  if (typeof window === "undefined") return freshManhuntState(day);

  const parsed = readManhuntDays()[String(day)];
  if (!parsed) return freshManhuntState(day);
  return normalizeManhuntState(parsed, day);
}

export function saveManhuntState(state: ManhuntState) {
  if (typeof window === "undefined") return;
  const days = readManhuntDays();
  days[String(state.day)] = state;
  writeManhuntDays(days);
  queueManhuntAccountSync();
}

function queueManhuntAccountSync() {
  if (typeof window === "undefined") return;
  void import("@/src/core/account-sync").then(({ scheduleAccountSync }) => {
    scheduleAccountSync();
  });
}

export function resetManhuntState(day = puzzleNumber()): ManhuntState {
  const state = freshManhuntState(day);
  saveManhuntState(state);
  return state;
}

export function loadManhuntStats(): ManhuntStats {
  if (typeof window === "undefined") return emptyStats();

  try {
    const raw = window.localStorage.getItem(MANHUNT_STATS_KEY);
    if (!raw) return emptyStats();
    return { ...emptyStats(), ...(JSON.parse(raw) as ManhuntStats) };
  } catch {
    return emptyStats();
  }
}

export function saveManhuntStats(stats: ManhuntStats) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MANHUNT_STATS_KEY, JSON.stringify(stats));
  queueManhuntAccountSync();
}

export function exportManhuntBundle(): { days: Record<string, ManhuntState>; stats: ManhuntStats } {
  return {
    days: readManhuntDays(),
    stats: loadManhuntStats(),
  };
}

export function importManhuntBundle(bundle: {
  days: Record<string, ManhuntState>;
  stats?: ManhuntStats;
}) {
  if (typeof window === "undefined") return;

  const existing = readManhuntDays();
  const merged = mergeManhuntDays(existing, bundle.days);
  writeManhuntDays(merged);

  if (bundle.stats) {
    window.localStorage.setItem(
      MANHUNT_STATS_KEY,
      JSON.stringify(mergeManhuntStats(loadManhuntStats(), bundle.stats)),
    );
  }
}

function mergeManhuntDays(
  left: Record<string, ManhuntState>,
  right: Record<string, ManhuntState>,
): Record<string, ManhuntState> {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const merged: Record<string, ManhuntState> = {};

  for (const key of keys) {
    const local = left[key];
    const remote = right[key];
    if (local && remote) {
      merged[key] = mergeManhuntStates(local, remote);
    } else {
      merged[key] = (local ?? remote)!;
    }
  }

  return merged;
}

function mergeManhuntStates(left: ManhuntState, right: ManhuntState): ManhuntState {
  if (left.status === "won" && right.status === "won") {
    return left.nuggets >= right.nuggets ? left : right;
  }
  if (left.status === "won") return left;
  if (right.status === "won") return right;

  const progress = (state: ManhuntState) =>
    state.revealCount * 10 + state.misses.length * 5 + (MANHUNT_CONFIG.budget - state.nuggets);
  const preferred = progress(left) >= progress(right) ? left : right;
  const other = preferred === left ? right : left;

  return {
    ...preferred,
    day: left.day,
    revealed: Array.from(new Set([...preferred.revealed, ...other.revealed])),
    misses: [...new Set([...preferred.misses, ...other.misses])],
    nuggets: Math.min(preferred.nuggets, other.nuggets),
    revealCount: Math.max(preferred.revealCount, other.revealCount),
  };
}

function mergeManhuntStats(left: ManhuntStats, right: ManhuntStats): ManhuntStats {
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

export function isFieldRevealed(state: ManhuntState, field: ManhuntFieldId): boolean {
  return state.revealed.includes(field);
}

export function isFullyRevealed(state: ManhuntState): boolean {
  return state.status === "won" || (state.status === "playing" && state.nuggets === 0);
}

export function allPaidFieldsRevealed(state: ManhuntState): string[] {
  if (isFullyRevealed(state)) {
    return ALL_PAID_FIELDS.filter((field) => !state.revealed.includes(field));
  }
  return [];
}

export function withAutoReveal(state: ManhuntState): ManhuntState {
  if (state.nuggets > 0 || state.status === "won") return state;
  return {
    ...state,
    revealed: Array.from(new Set([...state.revealed, ...ALL_PAID_FIELDS])),
  };
}

export function canRevealManhuntField(nuggets: number, cost: number): boolean {
  return cost < nuggets;
}

export function recordManhuntReveal(state: ManhuntState, field: ManhuntFieldId): ManhuntState | null {
  if (state.status === "won" || isFieldRevealed(state, field)) return null;

  const config = MANHUNT_CONFIG.fields.find((entry) => entry.id === field);
  if (!config || !canRevealManhuntField(state.nuggets, config.cost)) return null;

  const next: ManhuntState = {
    ...state,
    nuggets: state.nuggets - config.cost,
    revealed: [...state.revealed, field],
    revealCount: state.revealCount + 1,
  };

  return withAutoReveal(next);
}

export function recordManhuntMiss(state: ManhuntState, npcId: string): ManhuntState | null {
  if (state.status === "won" || state.misses.includes(npcId) || state.nuggets === 0) return null;

  const next: ManhuntState = {
    ...state,
    misses: [...state.misses, npcId],
    nuggets: state.nuggets > 0 ? state.nuggets - MANHUNT_CONFIG.missCost : 0,
  };

  return withAutoReveal(next);
}

export function recordManhuntWin(state: ManhuntState): ManhuntState {
  return {
    ...withAutoReveal(state),
    status: "won",
    finishedAt: new Date().toISOString(),
  };
}

export function recordManhuntStatsWin(day: number, score: number): ManhuntStats {
  const stats = loadManhuntStats();
  const streak = stats.lastWonDay === day - 1 ? stats.streak + 1 : 1;
  const distKey = String(score);

  return {
    played: stats.played + 1,
    won: stats.won + 1,
    streak,
    maxStreak: Math.max(stats.maxStreak, streak),
    lastWonDay: day,
    bestScore: Math.max(stats.bestScore, score),
    totalScore: stats.totalScore + score,
    dist: {
      ...stats.dist,
      [distKey]: (stats.dist[distKey] ?? 0) + 1,
    },
  };
}
