import { MANHUNT_CONFIG } from "./config";

export function xpForManhunt(remainingNuggets: number): number {
  const n = Math.max(0, Math.min(MANHUNT_CONFIG.budget, remainingNuggets));
  return MANHUNT_CONFIG.xp.base + MANHUNT_CONFIG.xp.perNugget * n;
}

export function hunterLevel(totalXp: number): number {
  let level = 1;
  let threshold = 0;

  while (true) {
    const nextThreshold = threshold + MANHUNT_CONFIG.xp.levelStep * level;
    if (totalXp < nextThreshold) return level;
    threshold = nextThreshold;
    level += 1;
  }
}

export function hunterLevelAfterGain(previousXp: number, gained: number): number | null {
  const before = hunterLevel(previousXp);
  const after = hunterLevel(previousXp + gained);
  return after > before ? after : null;
}

/** Telemetry attempts compatible with classic points formula (higher nuggets → fewer attempts). */
export function telemetryAttemptsFromNuggets(remainingNuggets: number): number {
  if (remainingNuggets <= 0) return MANHUNT_CONFIG.budget + 1;
  return MANHUNT_CONFIG.budget - remainingNuggets + 1;
}
