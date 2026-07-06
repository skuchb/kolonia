import type { Locale, Npc, Quote } from "@/src/core/types";
import { npcDisplayName } from "@/src/data";
import { campLabel, getDictionary, guildLabel, npcLocationLabel, roleLabel } from "@/src/i18n";
import { teacherCategoryForName, tradeCategoryForName } from "./categories";
import type { ManhuntFieldId } from "./types";

function firstLetter(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "—";
  return trimmed[0]!.toUpperCase();
}

function quoteLineForNpc(quote: Quote | null | undefined, lang: Locale): string | null {
  if (!quote) return null;
  const npcLine = quote.lines.find((line) => line.speaker === "npc");
  return npcLine?.text[lang] ?? quote.lines[0]?.text[lang] ?? null;
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
      const camp = dict.ui.manhunt.escapedCamps[npc.guildFamily as keyof typeof dict.ui.manhunt.escapedCamps];
      return camp ?? campLabel(lang, npc.guildFamily);
    }
    case "guild": {
      const role = roleLabel(lang, npc.role);
      const guild = guildLabel(lang, npc.guild);
      if (role && role !== npc.role) return role;
      return guild || empty;
    }
    case "location":
      return npcLocationLabel(lang, npc) || empty;
    case "letter":
      return firstLetter(npcDisplayName(npc, lang));
    case "teacher": {
      const category = teacherCategoryForName(npc.name);
      if (!category) return empty;
      return dict.ui.manhunt.teacherCategories[category] ?? empty;
    }
    case "trade": {
      const category = tradeCategoryForName(npc.name);
      if (!category) return empty;
      return dict.ui.manhunt.tradeCategories[category] ?? empty;
    }
    case "quote": {
      const line = quoteLineForNpc(quote, lang);
      return line || empty;
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
