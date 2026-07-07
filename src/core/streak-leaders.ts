import { PLAYER_CAMPS } from "./camp-war";
import type { PlayerCamp } from "./types";

export interface StreakLeaderEntry {
  nick: string;
  streak: number;
}

export interface StreakLeadersCamp {
  camp: PlayerCamp;
  leaders: StreakLeaderEntry[];
}

export interface StreakLeaders {
  camps: StreakLeadersCamp[];
}

const EMPTY_STREAK_LEADERS: StreakLeaders = {
  camps: PLAYER_CAMPS.map((camp) => ({ camp, leaders: [] })),
};

export async function fetchStreakLeaders(): Promise<StreakLeaders> {
  try {
    const response = await fetch("/api/streak-leaders");
    if (!response.ok) return EMPTY_STREAK_LEADERS;
    return (await response.json()) as StreakLeaders;
  } catch {
    return EMPTY_STREAK_LEADERS;
  }
}
