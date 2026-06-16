import dictDe from "./dict.de.json";
import dictEn from "./dict.en.json";
import dictPl from "./dict.pl.json";
import type { Locale, Npc } from "@/src/core/types";

const dictionaries = {
  pl: dictPl,
  en: dictEn,
  de: dictDe,
} as const;

export type Dictionary = (typeof dictionaries)["pl"];

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "pl";
  const language = navigator.language.toLowerCase();
  if (language.startsWith("de")) return "de";
  if (language.startsWith("en")) return "en";
  return "pl";
}

export function campLabel(locale: Locale, camp: string): string {
  const dict = getDictionary(locale);
  return dict.camps[camp as keyof Dictionary["camps"]] ?? camp;
}

export function playerCampLabel(locale: Locale, camp: string): string {
  const dict = getDictionary(locale);
  return dict.playerCamps[camp as keyof Dictionary["playerCamps"]] ?? camp;
}

export function guildLabel(locale: Locale, guild: string): string {
  const dict = getDictionary(locale);
  return dict.guilds[guild as keyof Dictionary["guilds"]] ?? guild;
}

export function npcTypeLabel(locale: Locale, npctype: string): string {
  const dict = getDictionary(locale);
  return dict.npctypes[npctype as keyof Dictionary["npctypes"]] ?? npctype;
}

export function roleLabel(locale: Locale, role: string): string {
  const dict = getDictionary(locale);
  return dict.roles[role as keyof Dictionary["roles"]] ?? role;
}

export function locationLabel(locale: Locale, location: string): string {
  const dict = getDictionary(locale);
  return dict.locations[location as keyof Dictionary["locations"]] ?? location;
}

export function npcLocationLabel(locale: Locale, npc: Npc): string {
  const dict = getDictionary(locale);
  return (
    dict.locations[npc.location as keyof Dictionary["locations"]] ??
    dict.locations[npc.locationArea as keyof Dictionary["locations"]] ??
    dict.locations.UNKNOWN
  );
}

export function combatStyleLabel(locale: Locale, combatStyle: string): string {
  const dict = getDictionary(locale);
  return dict.combatStyles[combatStyle as keyof Dictionary["combatStyles"]] ?? combatStyle;
}

export function rankLabel(locale: Locale, camp: string): string {
  const dict = getDictionary(locale);
  return dict.ranks[camp as keyof Dictionary["ranks"]] ?? "";
}
