import type { Locale, Npc } from "@/src/core/types";
import { getDictionary, guildLabel } from "@/src/i18n";

export interface QuoteHint {
  id: "camp" | "letter";
  text: string;
}

export function quoteHints(
  wrongAttempts: number,
  targetNpc: Npc,
  locale: Locale,
): QuoteHint[] {
  const dict = getDictionary(locale);
  const hints: QuoteHint[] = [];

  if (wrongAttempts >= 3) {
    hints.push({
      id: "camp",
      text: `${dict.ui.hintCamp}: ${guildLabel(locale, targetNpc.guild)}`,
    });
  }

  if (wrongAttempts >= 5) {
    hints.push({
      id: "letter",
      text: `${dict.ui.hintLetter}: ${targetNpc.name[0]?.toUpperCase() ?? "?"}`,
    });
  }

  return hints;
}
