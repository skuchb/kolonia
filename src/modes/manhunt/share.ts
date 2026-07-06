import { shareDomain } from "@/src/core/site";
import type { Locale } from "@/src/core/types";
import { getDictionary } from "@/src/i18n";
import { MANHUNT_CONFIG } from "./config";

export function buildManhuntShareText(options: {
  puzzle: number;
  score: number;
  reveals: number;
  misses: number;
  lang: Locale;
  domain?: string;
}): string {
  const dict = getDictionary(options.lang);
  const modeLabel = dict.ui.modeManhunt;

  return [
    `KOLONIA · ${modeLabel} №${options.puzzle}`,
    `🪨 ${options.score}/${MANHUNT_CONFIG.budget} · 🔍 ${options.reveals} · ❌ ${options.misses}`,
    options.domain ?? shareDomain(),
  ].join("\n");
}
