import type { Locale, Npc, Quote } from "@/src/core/types";
import { npcDisplayName } from "@/src/data";
import { campLabel, getDictionary, guildLabel, npcLocationLabel } from "@/src/i18n";
import { teacherCategoryForName, tradeCategoryForName } from "./categories";
import type { ManhuntFieldId } from "./types";

function firstLetter(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "—";
  return trimmed[0]!.toUpperCase();
}

function quoteTextForManhunt(quote: Quote | null | undefined, lang: Locale): string | null {
  if (!quote) return null;

  const npcLines = quote.lines
    .filter((line) => line.speaker === "npc")
    .map((line) => line.text[lang]?.trim())
    .filter((line): line is string => Boolean(line));

  if (npcLines.length > 0) {
    return npcLines.join("\n");
  }

  const allLines = quote.lines
    .map((line) => line.text[lang]?.trim())
    .filter((line): line is string => Boolean(line));

  return allLines.length > 0 ? allLines.join("\n") : null;
}

export function manhuntFieldValue(
  field: ManhuntFieldId,
  npc: Npc,
  quote: Quote | null | undefined,
  lang: Locale,
): string {
  const dict = getDictionary(lang);
  const empty = dict.ui.manhunt.emptyField;

  switch (field) {
    case "camp": {
      const campName = campLabel(lang, npc.guildFamily);
      return `${dict.ui.manhunt.campPrefix}: ${campName}`;
    }
    case "guild":
      return guildLabel(lang, npc.guild) || empty;
    case "location":
      return npcLocationLabel(lang, npc) || empty;
    case "letter":
      return firstLetter(npcDisplayName(npc, lang));
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
    case "quote": {
      const text = quoteTextForManhunt(quote, lang);
      return text || empty;
    }
    default:
      return empty;
  }
}

export function manhuntPortraitUrl(npc: Npc, revealed: boolean): string | null {
  if (!revealed) return null;
  if (npc.photo) return `/portraits/gothic1/${npc.photo}`;
  if (npc.originalId) return `/portraits/gothic1/${npc.originalId}.jpg`;
  return null;
}
