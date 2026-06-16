import type { ModeId } from "./types";

export const LAUNCH_DAY = "2026-06-15";
export const TIMEZONE = "Europe/Warsaw";
export const CURATED_DAYS = 0;

export const CURATED_CLASSIC_IDS: readonly string[] = [];
export const CURATED_QUOTE_IDS: readonly string[] = [];

const MODE_SEEDS: Record<ModeId, number> = {
  classic: 0x474f54,
  quote: 0x474f55,
  map: 0x474f56,
  card: 0x474f57,
};

export function puzzleNumber(now = new Date()): number {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(now);
  return Math.max(0, Math.round((Date.parse(day) - Date.parse(LAUNCH_DAY)) / 86_400_000));
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildPermutation(length: number, seed = 0x474f54): number[] {
  const rng = mulberry32(seed);
  const order = Array.from({ length }, (_, index) => index);

  for (let index = length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }

  return order;
}

function curatedIdForDay(puzzle: number, mode: ModeId): string | undefined {
  if (puzzle < 0 || puzzle >= CURATED_DAYS) return undefined;
  const schedule = mode === "classic" ? CURATED_CLASSIC_IDS : CURATED_QUOTE_IDS;
  return schedule[puzzle];
}

export function dailyItem<T extends { id: string }>(pool: T[], puzzle: number, mode: ModeId): T {
  if (pool.length === 0) {
    throw new Error("dailyItem: pool must not be empty");
  }

  const safePuzzle = Math.max(0, puzzle);
  const curatedId = curatedIdForDay(safePuzzle, mode);

  if (curatedId) {
    const curated = pool.find((item) => item.id === curatedId);
    if (curated) return curated;
  }

  const permutation = buildPermutation(pool.length, MODE_SEEDS[mode]);
  const index = ((safePuzzle % pool.length) + pool.length) % pool.length;
  return pool[permutation[index]];
}

export function msUntilReset(now = new Date()): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );

  const elapsed =
    Number(parts.hour) * 3_600_000 +
    Number(parts.minute) * 60_000 +
    Number(parts.second) * 1_000;

  return Math.max(0, 86_400_000 - elapsed);
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}
