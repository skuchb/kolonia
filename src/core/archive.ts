import { puzzleNumber } from "./daily";
import type { ModeId } from "./types";

/** First puzzle day with a published Manhunt schedule. */
export const MANHUNT_FIRST_PUZZLE = 21;

export function isArchivePuzzle(puzzle: number, today = puzzleNumber()): boolean {
  return puzzle < today;
}

export function minArchivePuzzle(mode: ModeId): number {
  return mode === "manhunt" ? MANHUNT_FIRST_PUZZLE : 0;
}

export function canGoToPreviousPuzzle(mode: ModeId, viewPuzzle: number): boolean {
  return viewPuzzle > minArchivePuzzle(mode);
}

export function canGoToNextPuzzle(viewPuzzle: number, today = puzzleNumber()): boolean {
  return viewPuzzle < today;
}
