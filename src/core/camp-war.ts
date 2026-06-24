import type { PlayerCamp } from "./types";

export const PLAYER_CAMPS: PlayerCamp[] = ["OLD_CAMP", "NEW_CAMP", "SWAMP_CAMP"];

export const CAMP_WAR_MIN_SOLVES = 30;

export function weekNumber(puzzle: number) {
  return Math.floor(puzzle / 7) + 1;
}

export function weekDay(puzzle: number) {
  return (puzzle % 7) + 1;
}

export function puzzleWeekRange(puzzle: number) {
  const weekIndex = Math.floor(puzzle / 7);
  return {
    week: weekIndex + 1,
    day: weekDay(puzzle),
    startPuzzle: weekIndex * 7,
    endPuzzle: weekIndex * 7 + 6,
  };
}

export interface CampWarCampStats {
  camp: PlayerCamp;
  solves: number;
  totalPoints: number;
  avgPoints: number;
  avgAttempts: number;
  sharePct: number;
}

export interface CampWarStats {
  week: number;
  day: number;
  startPuzzle: number;
  endPuzzle: number;
  totalSolves: number;
  camps: CampWarCampStats[];
  leader: PlayerCamp | null;
  ready: boolean;
}

const EMPTY_CAMPS: CampWarCampStats[] = PLAYER_CAMPS.map((camp) => ({
  camp,
  solves: 0,
  totalPoints: 0,
  avgPoints: 0,
  avgAttempts: 0,
  sharePct: 0,
}));

export const EMPTY_CAMP_WAR_STATS: CampWarStats = {
  week: 1,
  day: 1,
  startPuzzle: 0,
  endPuzzle: 6,
  totalSolves: 0,
  camps: EMPTY_CAMPS,
  leader: null,
  ready: false,
};

export async function fetchCampWarStats(puzzle: number): Promise<CampWarStats | null> {
  try {
    const response = await fetch(`/api/camp-war?puzzle=${puzzle}`);
    if (!response.ok) return null;
    return (await response.json()) as CampWarStats;
  } catch {
    return null;
  }
}
