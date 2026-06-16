import type { DailyCardPuzzle, DailyMapPuzzle, ModeId, Npc, Quote } from "./types";
import { dailyItem } from "./daily";
import { npcPool, quotePool } from "@/src/data";

export type DailyClassicResponse = { mode: "classic"; puzzle: number; npc: Npc };
export type DailyQuoteResponse = { mode: "quote"; puzzle: number; quote: Quote };
export type DailyMapResponse = DailyMapPuzzle;
export type DailyCardResponse = DailyCardPuzzle;

export type DailyResponse = DailyClassicResponse | DailyQuoteResponse | DailyMapResponse | DailyCardResponse;

export async function fetchDailyPuzzle(
  mode: ModeId,
  puzzle: number,
): Promise<DailyResponse | null> {
  try {
    const response = await fetch(`/api/daily?mode=${mode}&puzzle=${puzzle}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as DailyResponse;
  } catch {
    return null;
  }
}

export function fallbackDailyClassic(puzzle: number): Npc {
  return dailyItem(npcPool, puzzle, "classic");
}

export function fallbackDailyCard(puzzle: number): Npc {
  return dailyItem(npcPool, puzzle, "card");
}

export function fallbackDailyQuote(puzzle: number): Quote {
  return dailyItem(quotePool, puzzle, "quote");
}

export async function submitMapGuess(puzzle: number, x: number, y: number) {
  const response = await fetch("/api/daily/map/guess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ puzzle, x, y }),
  });
  if (!response.ok) {
    throw new Error("map_guess_failed");
  }
  return (await response.json()) as {
    distanceMeters: number;
    solved: boolean;
    toleranceMeters: number;
  };
}
