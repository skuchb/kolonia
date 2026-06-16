import npcData from "./npc.json";
import quoteData from "./quotes.json";
import type { Locale, Npc, Quote } from "@/src/core/types";

export const npcPool = npcData as Npc[];
export const quotePool = quoteData as Quote[];

export function getNpcById(id: string): Npc | undefined {
  return npcPool.find((npc) => npc.id === id);
}

export function npcDisplayName(npc: Npc, locale: Locale): string {
  return npc.names?.[locale] ?? npc.name;
}
