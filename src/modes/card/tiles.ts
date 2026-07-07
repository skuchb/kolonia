export const CARD_TILE_COLS = 4;
export const CARD_TILE_ROWS = 6;
export const CARD_TILE_COUNT = CARD_TILE_COLS * CARD_TILE_ROWS;

export function pickRandomUnrevealedCardTile(revealed: ReadonlySet<number>): number | null {
  const unrevealed: number[] = [];
  for (let index = 0; index < CARD_TILE_COUNT; index += 1) {
    if (!revealed.has(index)) unrevealed.push(index);
  }
  if (unrevealed.length === 0) return null;
  return unrevealed[Math.floor(Math.random() * unrevealed.length)]!;
}

export function revealRandomCardTile(revealed: ReadonlySet<number>): Set<number> {
  const tile = pickRandomUnrevealedCardTile(revealed);
  if (tile === null) return new Set(revealed);
  const next = new Set(revealed);
  next.add(tile);
  return next;
}
