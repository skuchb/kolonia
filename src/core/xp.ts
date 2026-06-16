const ATTEMPT_BONUS = [80, 60, 50, 40, 20, 20] as const;
export const XP_BASE = 100;

export function xpBonusForAttempts(attempts: number): number {
  if (attempts < 1) return 0;
  if (attempts <= ATTEMPT_BONUS.length) return ATTEMPT_BONUS[attempts - 1]!;
  return 0;
}

export function xpForSolve(attempts: number): number {
  return XP_BASE + xpBonusForAttempts(attempts);
}

export function rankForXp(totalXp: number): "digger" | "rogue" | "shadow" | "guru" {
  if (totalXp >= 5000) return "guru";
  if (totalXp >= 2000) return "shadow";
  if (totalXp >= 500) return "rogue";
  return "digger";
}
