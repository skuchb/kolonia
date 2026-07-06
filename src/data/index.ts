import npcData from "./npc.json";
import manhuntPoolData from "./manhunt-pool.json";
import quoteData from "./quotes.json";
import type { Locale, Npc, Quote } from "@/src/core/types";

export const npcPool = npcData as Npc[];
export const quotePool = quoteData as Quote[];
export const manhuntAnswerIds = new Set((manhuntPoolData as { ids: string[] }).ids);

export function manhuntAnswerPool(): Npc[] {
  const pool = npcPool.filter((npc) => manhuntAnswerIds.has(npc.id));
  return pool.length > 0 ? pool : npcPool;
}

export function getNpcById(id: string): Npc | undefined {
  return npcPool.find((npc) => npc.id === id);
}

export function primaryQuoteForNpc(npcId: string): Quote | undefined {
  return quotePool.find((quote) => quote.npcId === npcId);
}

export function npcDisplayName(npc: Npc, locale: Locale): string {
  return npc.names?.[locale] ?? npc.name;
}
