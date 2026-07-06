import type { Locale } from "@/src/core/types";
import { getDictionary } from "@/src/i18n";

export function oreNuggetCountLabel(count: number, lang: Locale): string {
  const dict = getDictionary(lang);
  const labels = dict.ui.manhunt.nuggetLabels;

  if (lang === "pl") {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (count === 1) return labels.one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return labels.few.replace("{count}", String(count));
    }
    return labels.many.replace("{count}", String(count));
  }

  if (count === 1) return labels.one;
  return labels.many.replace("{count}", String(count));
}

export function manhuntPurseLabel(count: number, lang: Locale): string {
  const dict = getDictionary(lang);
  return dict.ui.manhunt.purseWithCount.replace("{nuggets}", oreNuggetCountLabel(count, lang));
}
