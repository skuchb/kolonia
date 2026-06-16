export type Camp = "OLD_CAMP" | "NEW_CAMP" | "SWAMP_CAMP" | "FIRE_MAGES" | "WATER_MAGES" | "NONE";

export type PlayerCamp = "OLD_CAMP" | "NEW_CAMP" | "SWAMP_CAMP";

export type Locale = "pl" | "en" | "de";

export type ModeId = "classic" | "quote" | "map" | "card";

export type FeedbackCell = "good" | "near" | "bad" | "up" | "down";

export interface LocalizedText {
  pl: string;
  en: string;
  de: string;
}

export interface RoutineSlot {
  activity: string;
  from: string;
  to: string;
  waypoint: string;
  note?: string;
}

export interface NpcRoutine {
  name: string;
  slots: RoutineSlot[];
}

export interface StartupLocation {
  waypoint: string;
  note?: string;
}

export interface NpcInventoryItem {
  action: string;
  item: string;
  count: number;
}

export interface NpcTalent {
  id: string;
  skill: number;
}

export interface Npc {
  id: string;
  name: string;
  names: LocalizedText;
  aliases?: string[];
  sourceFile: string;
  guild: string;
  guildFamily: string;
  role: string;
  combatStyle: string;
  npctype: string;
  level: number;
  voice: number | null;
  originalId: number | null;
  flags?: string | null;
  fightTactic?: string | null;
  dailyRoutine?: string | null;
  location: string;
  locationArea: string;
  isTeacher: boolean;
  isFriend: boolean;
  startupLocations: StartupLocation[];
  routines: NpcRoutine[];
  attributes: Record<string, number>;
  protection: Record<string, number>;
  talents: NpcTalent[];
  inventory: NpcInventoryItem[];
}

export interface QuoteLine {
  speaker: "hero" | "npc";
  text: LocalizedText;
}

export interface Quote {
  id: string;
  npcId: string;
  lines: QuoteLine[];
  context?: LocalizedText;
}

export interface MapGuess {
  x: number;
  y: number;
  distanceMeters: number;
}

export interface ModeDay {
  puzzle: number;
  guesses: string[];
  mapGuesses?: MapGuess[];
  solved: boolean;
}

export interface UserProfileProgress {
  totalXp: number;
  rank: "digger" | "rogue" | "shadow" | "guru";
}

export interface DailyMapPuzzle {
  puzzle: number;
  mode: "map";
  npcId: string;
  npcName: LocalizedText;
  chapter?: LocalizedText | null;
  map: {
    id: string;
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
    metersPerPixel: number;
  };
  toleranceMeters: number;
}

export interface DailyCardPuzzle {
  puzzle: number;
  mode: "card";
  npc: Npc;
}

export interface MapGuessResult {
  distanceMeters: number;
  solved: boolean;
  attempts: number;
  xpEarned?: number;
}

export interface ModeStats {
  played: number;
  won: number;
  streak: number;
  maxStreak: number;
  lastWonPuzzle: number;
  dist: Record<string, number>;
}

export interface Persisted {
  version: 1;
  lang: Locale;
  camp: PlayerCamp | null;
  totalXp: number;
  seenHelp?: boolean;
  modes: Partial<Record<ModeId, ModeDay>>;
  stats: Partial<Record<ModeId, ModeStats>>;
}

export interface ClassicGuessRow {
  npcId: string;
  name: string;
  feedback: FeedbackCell[];
}

export interface QuoteGuessRow {
  npcId: string;
  name: string;
  feedback: FeedbackCell[];
}
