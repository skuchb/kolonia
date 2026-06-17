import { feedbackToEmoji } from "./feedback";
import { shareDomain } from "./site";
import type { FeedbackCell, Locale, ModeId, ModeStats } from "./types";

export function buildShareText(options: {
  puzzle: number;
  mode: ModeId;
  attempts: number;
  streak: number;
  rows: FeedbackCell[][];
  domain?: string;
  lang?: Locale;
}): string {
  const lang = options.lang ?? "pl";
  const modeLabel =
    options.mode === "classic"
      ? lang === "en"
        ? "Classic"
        : lang === "de"
          ? "Klassisch"
          : "Klasyczny"
      : options.mode === "map"
        ? lang === "en"
          ? "Map"
          : lang === "de"
            ? "Karte"
            : "Mapa"
        : options.mode === "card"
          ? lang === "en"
            ? "Card"
            : lang === "de"
              ? "Karte"
              : "Karta"
        : lang === "en"
          ? "Quote"
          : lang === "de"
            ? "Zitat"
            : "Cytat";
  const lines = options.rows.map((row) => row.map(feedbackToEmoji).join(""));
  const hiddenLabel =
    lang === "en"
      ? "earlier"
      : lang === "de"
        ? "früher"
        : "wcześniejszych";
  const visibleRows =
    lines.length > 8
      ? [...lines.slice(-8), `(+${lines.length - 8} ${hiddenLabel})`]
      : lines;
  const attemptsLabel =
    lang === "en" ? "Solved in" : lang === "de" ? "Gelöst in" : "Zgadnięte w";
  const streakLabel =
    lang === "en" ? "streak" : lang === "de" ? "Serie" : "seria";

  return [
    `KOLONIA #${options.puzzle} — ${modeLabel}`,
    `${attemptsLabel} ${options.attempts} | ${streakLabel}: ${options.streak}🔥`,
    "",
    ...visibleRows,
    "",
    options.domain ?? shareDomain(),
  ].join("\n");
}

export async function shareResult(text: string): Promise<"shared" | "copied"> {
  if (shouldUseNativeShare()) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch {
      // fall through to clipboard
    }
  }

  await copyToClipboard(text);
  return "copied";
}

export function streakLabel(stats: ModeStats): string {
  return String(stats.streak);
}

function shouldUseNativeShare(): boolean {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  if (typeof window === "undefined" || !window.matchMedia) return false;

  return window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(max-width: 767px)").matches;
}

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
