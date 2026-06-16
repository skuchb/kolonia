import type { ModeId } from "./types";

export interface DayStats {
  players: number;
  solved: number;
  solvedPct: number;
  avgAttempts: number;
  percentile?: number;
  ready: boolean;
}

export async function fetchDayStats(
  mode: ModeId,
  puzzle: number,
  attempts?: number,
): Promise<DayStats | null> {
  const params = new URLSearchParams({ mode, puzzle: String(puzzle) });
  if (attempts !== undefined) params.set("attempts", String(attempts));

  try {
    const response = await fetch(`/api/stats?${params.toString()}`);
    if (!response.ok) return null;
    return (await response.json()) as DayStats;
  } catch {
    return null;
  }
}
