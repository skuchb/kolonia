import type { DailyCardPuzzle, DailyMapPuzzle, LocalizedText, ModeId, Npc, Quote } from "./types";
import { dailyItem } from "./daily";
import { getNpcById, npcPool, quotePool } from "@/src/data";

const FALLBACK_MAP = {
  id: "kolonia",
  imageUrl: "/maps/kolonia.png",
  imageWidth: 1024,
  imageHeight: 782,
  metersPerPixel: 2.5,
  defaultToleranceMeters: 80,
};

const FALLBACK_MAP_TARGETS: Array<{ npcId: string; chapter?: LocalizedText | null }> = [
  { npcId: "EBR_100_Gomez", chapter: { pl: "Rozdział 2", en: "Chapter 2", de: "Kapitel 2" } },
  { npcId: "GUR_1201_CorKalom", chapter: { pl: "Rozdział 3", en: "Chapter 3", de: "Kapitel 3" } },
  { npcId: "KDF_404_Xardas" },
  { npcId: "VLK_538_Huno" },
  { npcId: "SLD_729_Kharim" },
  { npcId: "GUR_1204_BaalNamib" },
  { npcId: "ORG_700_Lester" },
];

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

export function fallbackDailyMap(puzzle: number): DailyMapPuzzle {
  const target = dailyItem(FALLBACK_MAP_TARGETS, puzzle, "map");
  const npc = getNpcById(target.npcId) ?? dailyItem(npcPool, puzzle, "map");

  return {
    puzzle,
    mode: "map",
    npcId: npc.id,
    npcName: npc.names,
    chapter: target.chapter ?? null,
    map: {
      id: FALLBACK_MAP.id,
      imageUrl: FALLBACK_MAP.imageUrl,
      imageWidth: FALLBACK_MAP.imageWidth,
      imageHeight: FALLBACK_MAP.imageHeight,
      metersPerPixel: FALLBACK_MAP.metersPerPixel,
    },
    toleranceMeters: FALLBACK_MAP.defaultToleranceMeters,
  };
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
