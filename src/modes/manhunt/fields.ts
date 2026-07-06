import type { Locale, Npc, Quote, QuoteLine } from "@/src/core/types";
import { npcDisplayName } from "@/src/data";
import { campLabel, getDictionary, guildLabel, npcLocationLabel } from "@/src/i18n";
import { teacherCategoryForName, tradeCategoryForName } from "./categories";
import type { ManhuntFieldId } from "./types";

function firstLetter(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "—";
  return trimmed[0]!.toUpperCase();
}

function quoteTextForManhunt(quote: Quote | null | undefined, npc: Npc, lang: Locale): string | null {
  const lines = manhuntQuoteLines(quote, npc, lang);
  if (lines.length === 0) return null;
  return lines.map((line) => `${line.who}: ${line.text}`).join("\n");
}

export function manhuntQuoteLines(
  quote: Quote | null | undefined,
  npc: Npc,
  lang: Locale,
): Array<{ who: string; text: string }> {
  if (!quote) return [];

  const dict = getDictionary(lang);
  const heroLabel = dict.ui.hero;
  const npcLabel = npcDisplayName(npc, lang);

  return quote.lines
    .map((line: QuoteLine) => {
      const text = line.text[lang]?.trim();
      if (!text) return null;
      const who = line.speaker === "hero" ? heroLabel : npcLabel;
      return { who, text };
    })
    .filter((line): line is { who: string; text: string } => Boolean(line));
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
      const text = quoteTextForManhunt(quote, npc, lang);
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
