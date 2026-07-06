import type { FeedbackCell, Locale, Npc } from "./types";
import { campLabel, getDictionary, guildLabel, npcLocationLabel } from "@/src/i18n";
import { teacherCategoryForName, tradeCategoryForName } from "@/src/modes/manhunt/categories";

export const FEEDBACK_COLUMN_KEYS = ["guild", "guildFamily", "location", "teacher", "trade"] as const;
export type FeedbackColumnKey = (typeof FEEDBACK_COLUMN_KEYS)[number];

export function gameFeedback(guess: Npc, target: Npc): FeedbackCell[] {
  return [
    compareExact(guess.guild, target.guild),
    compareExact(guess.guildFamily, target.guildFamily),
    compareLocation(guess, target),
    compareTeacher(guess, target),
    compareTrade(guess, target),
  ];
}

export function classicFeedback(guess: Npc, target: Npc): FeedbackCell[] {
  return gameFeedback(guess, target);
}

export function quoteFeedback(guess: Npc, target: Npc): FeedbackCell[] {
  return gameFeedback(guess, target);
}

export function feedbackColumnValue(key: FeedbackColumnKey, npc: Npc, lang: Locale): string {
  const dict = getDictionary(lang);

  switch (key) {
    case "guild":
      return guildLabel(lang, npc.guild) || "—";
    case "guildFamily":
      return campLabel(lang, npc.guildFamily) || "—";
    case "location":
      return npcLocationLabel(lang, npc) || "—";
    case "teacher": {
      const category = teacherCategoryForName(npc.name);
      if (!category) return dict.ui.manhunt.notTeacher;
      return dict.ui.manhunt.teacherCategories[category] ?? dict.ui.manhunt.notTeacher;
    }
    case "trade": {
      const category = tradeCategoryForName(npc.name);
      if (!category) return dict.ui.manhunt.notTrader;
      return dict.ui.manhunt.tradeCategories[category] ?? dict.ui.manhunt.notTrader;
    }
  }
}

export function feedbackToEmoji(cell: FeedbackCell): string {
  switch (cell) {
    case "good":
      return "🟩";
    case "near":
      return "🟨";
    case "bad":
      return "🟥";
    case "up":
      return "⬆️";
    case "down":
      return "⬇️";
  }
}

export function feedbackToPip(cell: FeedbackCell): "hit" | "near" | "miss" {
  if (cell === "good") return "hit";
  if (cell === "near" || cell === "up" || cell === "down") return "near";
  return "miss";
}

export function classicColumnKeys() {
  return FEEDBACK_COLUMN_KEYS;
}

function compareExact<T>(guess: T, target: T): FeedbackCell {
  return guess === target ? "good" : "bad";
}

function compareLocation(guess: Npc, target: Npc): FeedbackCell {
  return guess.location === target.location ? "good" : "bad";
}

function compareTeacher(guess: Npc, target: Npc): FeedbackCell {
  return compareExact(teacherCategoryForName(guess.name), teacherCategoryForName(target.name));
}

function compareTrade(guess: Npc, target: Npc): FeedbackCell {
  return compareExact(tradeCategoryForName(guess.name), tradeCategoryForName(target.name));
}
