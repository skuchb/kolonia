import { puzzleNumber } from "./daily";
import type { ModeId, ModeStats, Persisted } from "./types";
import type { ManhuntStats } from "@/src/modes/manhunt/types";

const TRACKED_MODES: ModeId[] = ["manhunt", "classic", "quote", "map", "card"];

export interface AccountStreakSource {
  stats?: Partial<Record<ModeId, ModeStats>>;
  manhuntStats?: ManhuntStats;
}

/** Current streak is alive only if the last win was today or yesterday. */
export function effectiveStreak(streak: number, lastWonPuzzle: number, today: number): number {
  if (streak < 1) return 0;
  if (lastWonPuzzle < today - 1) return 0;
  return streak;
}

export function readAccountCurrentStreak(
  source: AccountStreakSource,
  today: number = puzzleNumber(),
): number {
  let streak = 0;

  for (const mode of TRACKED_MODES) {
    const stats = source.stats?.[mode];
    if (!stats) continue;
    streak = Math.max(streak, effectiveStreak(stats.streak, stats.lastWonPuzzle, today));
  }

  if (source.manhuntStats) {
    const manhunt = source.manhuntStats;
    streak = Math.max(streak, effectiveStreak(manhunt.streak, manhunt.lastWonDay, today));
  }

  return streak;
}

/** Best streak ever achieved — kept even after the run ends. */
export function readAccountMaxStreak(source: AccountStreakSource): number {
  let maxStreak = 0;

  for (const mode of TRACKED_MODES) {
    const stats = source.stats?.[mode];
    if (!stats) continue;
    maxStreak = Math.max(maxStreak, stats.maxStreak ?? 0);
  }

  if (source.manhuntStats) {
    maxStreak = Math.max(maxStreak, source.manhuntStats.maxStreak ?? 0);
  }

  return maxStreak;
}

export function readAccountStreak(
  source: AccountStreakSource,
  today: number = puzzleNumber(),
): { streak: number; maxStreak: number } {
  return {
    streak: readAccountCurrentStreak(source, today),
    maxStreak: readAccountMaxStreak(source),
  };
}

export function readClientAccountStreak(
  persisted: Persisted,
  manhuntStats: ManhuntStats,
  today: number = puzzleNumber(),
) {
  return readAccountStreak({ stats: persisted.stats, manhuntStats }, today);
}
