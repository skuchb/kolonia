import { puzzleNumber } from "@/src/core/daily";
import { MANHUNT_CONFIG } from "./config";
import { MANHUNT_HELP_KEY, type ManhuntFieldId, ManhuntState, ManhuntStats } from "./types";

export const MANHUNT_STORAGE_KEY = "kolonia.manhunt.v1";
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

export function loadManhuntState(day = puzzleNumber()): ManhuntState {
  if (typeof window === "undefined") return freshManhuntState(day);

  try {
    const raw = window.localStorage.getItem(MANHUNT_STORAGE_KEY);
    if (!raw) return freshManhuntState(day);
    const parsed = JSON.parse(raw) as ManhuntState;
    if (parsed.day !== day) return freshManhuntState(day);
    return {
      ...freshManhuntState(day),
      ...parsed,
      revealed: Array.from(new Set([...MANHUNT_CONFIG.freeFields, ...(parsed.revealed ?? [])])),
      misses: parsed.misses ?? [],
      revealCount: parsed.revealCount ?? 0,
      startedAt: parsed.startedAt ?? Date.now(),
    };
  } catch {
    return freshManhuntState(day);
  }
}

export function saveManhuntState(state: ManhuntState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MANHUNT_STORAGE_KEY, JSON.stringify(state));
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

export function recordManhuntReveal(state: ManhuntState, field: ManhuntFieldId): ManhuntState | null {
  if (state.status === "won" || isFieldRevealed(state, field)) return null;

  const config = MANHUNT_CONFIG.fields.find((entry) => entry.id === field);
  if (!config || config.cost > state.nuggets) return null;

  const next: ManhuntState = {
    ...state,
    nuggets: state.nuggets - config.cost,
    revealed: [...state.revealed, field],
    revealCount: state.revealCount + 1,
  };

  return withAutoReveal(next);
}

export function recordManhuntMiss(state: ManhuntState, npcId: string): ManhuntState | null {
  if (state.status === "won" || state.misses.includes(npcId)) return null;

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
