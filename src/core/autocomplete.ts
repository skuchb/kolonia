import type { Npc } from "./types";

export function normalizeQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function npcSearchTerms(npc: Npc): string[] {
  return [npc.name, npc.names?.pl, npc.names?.en, npc.names?.de]
    .filter((value): value is string => Boolean(value))
    .map(normalizeQuery);
}

export function autocompleteNpc(
  pool: Npc[],
  query: string,
  excludedIds: string[],
  limit = 8,
): Npc[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];

  const excluded = new Set(excludedIds);

  return pool
    .filter((npc) => !excluded.has(npc.id))
    .map((npc) => {
      const terms = npcSearchTerms(npc);
      const prefix = terms.some((term) => term.startsWith(normalized));
      const substring = terms.some((term) => term.includes(normalized));
      const score = prefix ? 2 : substring ? 1 : 0;
      return { npc, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.npc.name.localeCompare(right.npc.name))
    .slice(0, limit)
    .map((entry) => entry.npc);
}

export function resolveNpcByInput(pool: Npc[], input: string): Npc | null {
  const normalized = normalizeQuery(input);
  if (!normalized) return null;

  return (
    pool.find((npc) => npcSearchTerms(npc).some((term) => term === normalized)) ?? null
  );
}
