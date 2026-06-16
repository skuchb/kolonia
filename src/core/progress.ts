import type { ModeId } from "./types";
import type { Persisted } from "./types";
import { profileFromPersisted } from "./auth";

export async function syncProgressToServer(
  token: string,
  state: Persisted,
  solve: {
    mode: ModeId;
    puzzle: number;
    attempts: number;
    xpEarned: number;
    distanceMeters?: number | null;
  },
) {
  const response = await fetch("/api/progress", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...profileFromPersisted(state),
      mode: solve.mode,
      puzzle: solve.puzzle,
      attempts: solve.attempts,
      xpEarned: solve.xpEarned,
      distanceMeters: solve.distanceMeters ?? null,
      totalXp: state.totalXp,
      progress: state.stats,
    }),
  });

  if (!response.ok) return null;
  return response.json() as Promise<{ totalXp: number; rank: string }>;
}
