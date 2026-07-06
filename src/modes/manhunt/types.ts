export type ManhuntFieldId = "camp" | "guild" | "location" | "letter" | "teacher" | "trade" | "quote";

export type ManhuntStatus = "playing" | "won";

export interface ManhuntState {
  day: number;
  nuggets: number;
  revealed: ManhuntFieldId[];
  misses: string[];
  status: ManhuntStatus;
  finishedAt?: string;
  revealCount: number;
  startedAt?: number;
}

export const MANHUNT_HELP_KEY = "kolonia.manhunt.help.v1";

export interface ManhuntStats {
  played: number;
  won: number;
  streak: number;
  maxStreak: number;
  lastWonDay: number;
  bestScore: number;
  totalScore: number;
  dist: Record<string, number>;
}
