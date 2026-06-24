import { detectLocale } from "@/src/i18n";
import { puzzleNumber } from "./daily";
import { xpForSolve } from "./xp";
import type { Locale, MapGuess, ModeDay, ModeId, ModeStats, Persisted, PlayerCamp } from "./types";

export const STORAGE_KEY = "kolonia_v1";
const LANG_KEY = "kolonia_lang";

function isLocale(value: string | null | undefined): value is Locale {
  return value === "pl" || value === "en" || value === "de";
}

export function readSavedLang(): Locale | null {
  if (typeof window === "undefined") return null;

  try {
    const fromStorage = window.localStorage.getItem(LANG_KEY);
    if (isLocale(fromStorage)) return fromStorage;

    const match = document.cookie.match(/(?:^|;\s*)kolonia_lang=(pl|en|de)(?:;|$)/);
    if (match && isLocale(match[1])) return match[1];
  } catch {
    // ignore
  }

  return null;
}

function saveLang(lang: Locale) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(LANG_KEY, lang);
  document.cookie = `kolonia_lang=${lang};path=/;max-age=31536000;SameSite=Lax`;
}

function resolveLang(fallback?: Locale): Locale {
  return readSavedLang() ?? fallback ?? detectLocale();
}

function emptyStats(): ModeStats {
  return {
    played: 0,
    won: 0,
    streak: 0,
    maxStreak: 0,
    lastWonPuzzle: -1,
    dist: {},
  };
}

export function defaultPersisted(): Persisted {
  return {
    version: 1,
    lang: "en",
    camp: null,
    totalXp: 0,
    modes: {},
    stats: {},
  };
}

export function loadPersisted(): Persisted {
  if (typeof window === "undefined") return defaultPersisted();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const lang = resolveLang();
      const initial = { ...defaultPersisted(), lang };
      saveLang(lang);
      savePersisted(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as Persisted;
    if (parsed.version !== 1) {
      const lang = resolveLang();
      const reset = { ...defaultPersisted(), lang };
      saveLang(lang);
      savePersisted(reset);
      return reset;
    }
    const lang = resolveLang(parsed.lang);
    saveLang(lang);
    return {
      ...defaultPersisted(),
      ...parsed,
      lang,
      totalXp: parsed.totalXp ?? 0,
    };
  } catch {
    const lang = resolveLang();
    saveLang(lang);
    return { ...defaultPersisted(), lang };
  }
}

export function savePersisted(state: Persisted) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function ensureModeDay(state: Persisted, mode: ModeId): ModeDay {
  const puzzle = puzzleNumber();
  const current = state.modes[mode];

  if (!current || current.puzzle !== puzzle) {
    return { puzzle, guesses: [], mapGuesses: mode === "map" ? [] : undefined, solved: false };
  }

  return current;
}

export function ensureModeStats(state: Persisted, mode: ModeId): ModeStats {
  return state.stats[mode] ?? emptyStats();
}

export function recordMapGuess(
  state: Persisted,
  guess: MapGuess,
  solved: boolean,
  xpEarned: number,
): Persisted {
  const puzzle = puzzleNumber();
  const day = ensureModeDay(state, "map");
  const stats = ensureModeStats(state, "map");
  const attempts = (day.mapGuesses?.length ?? 0) + 1;
  const nextDay: ModeDay = {
    puzzle,
    guesses: day.guesses,
    mapGuesses: [...(day.mapGuesses ?? []), guess],
    solved: solved || day.solved,
  };

  let nextState: Persisted = {
    ...state,
    modes: { ...state.modes, map: nextDay },
  };

  if (solved && !day.solved) {
    const streakContinues = stats.lastWonPuzzle === puzzle - 1;
    const streak = streakContinues ? stats.streak + 1 : 1;
    nextState = {
      ...nextState,
      totalXp: state.totalXp + xpEarned,
      stats: {
        ...nextState.stats,
        map: {
          ...stats,
          played: stats.played + 1,
          won: stats.won + 1,
          streak,
          maxStreak: Math.max(stats.maxStreak, streak),
          lastWonPuzzle: puzzle,
          dist: {
            ...stats.dist,
            [String(attempts)]: (stats.dist[String(attempts)] ?? 0) + 1,
          },
        },
      },
    };
  }

  return nextState;
}

export function recordGuess(
  state: Persisted,
  mode: ModeId,
  npcId: string,
  solved: boolean,
): Persisted {
  const puzzle = puzzleNumber();
  const day = ensureModeDay(state, mode);
  const stats = ensureModeStats(state, mode);
  const attempts = day.guesses.length + 1;
  const nextDay: ModeDay = {
    puzzle,
    guesses: [...day.guesses, npcId],
    solved: solved || day.solved,
  };

  let nextStats = { ...stats };

  if (solved && !day.solved) {
    const streakContinues = stats.lastWonPuzzle === puzzle - 1;
    const streak = streakContinues ? stats.streak + 1 : 1;
    nextStats = {
      ...nextStats,
      played: stats.played + 1,
      won: stats.won + 1,
      streak,
      maxStreak: Math.max(stats.maxStreak, streak),
      lastWonPuzzle: puzzle,
      dist: {
        ...stats.dist,
        [String(attempts)]: (stats.dist[String(attempts)] ?? 0) + 1,
      },
    };
  }

  let nextState: Persisted = {
    ...state,
    modes: { ...state.modes, [mode]: nextDay },
    stats: { ...state.stats, [mode]: nextStats },
  };

  if (solved && !day.solved) {
    nextState = {
      ...nextState,
      totalXp: state.totalXp + xpForSolve(attempts),
    };
  }

  return nextState;
}

export function setLanguage(state: Persisted, lang: Persisted["lang"]): Persisted {
  saveLang(lang);
  return { ...state, lang };
}

export function setCamp(state: Persisted, camp: PlayerCamp): Persisted {
  return { ...state, camp };
}

export function markHelpSeen(state: Persisted): Persisted {
  return { ...state, seenHelp: true };
}

export function effectiveness(stats: ModeStats): number {
  if (stats.played === 0) return 0;
  return stats.won / stats.played;
}

export function averageAttempts(stats: ModeStats): number {
  const entries = Object.entries(stats.dist);
  if (entries.length === 0) return 0;

  const totalAttempts = entries.reduce(
    (sum, [attempts, count]) => sum + Number(attempts) * count,
    0,
  );
  const totalWins = entries.reduce((sum, [, count]) => sum + count, 0);
  return totalWins === 0 ? 0 : totalAttempts / totalWins;
}
