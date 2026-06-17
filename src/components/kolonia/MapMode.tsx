"use client";

import type { Locale } from "@/src/core/types";
import type { DailyMapPuzzle } from "@/src/core/types";
import { getDictionary } from "@/src/i18n";

export function MapMode({
  mapPuzzle,
  lang,
  guesses,
  solved,
  onGuess,
  disabled,
}: {
  mapPuzzle: DailyMapPuzzle;
  lang: Locale;
  guesses: Array<{ x: number; y: number; distanceMeters: number }>;
  solved: boolean;
  onGuess: (x: number, y: number) => void;
  disabled?: boolean;
}) {
  const dict = getDictionary(lang);
  const chapter = mapPuzzle.chapter?.[lang];

  return (
    <div className="space-y-4">
      {chapter ? (
        <p className="font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--panel-ink)]/70">
          {dict.ui.chapter}: {chapter}
        </p>
      ) : null}

      <div className="relative bg-transparent">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={dict.ui.mapAlt}
          className={`block h-auto w-full bg-transparent ${disabled || solved ? "cursor-default" : "cursor-crosshair"}`}
          onClick={(event) => {
            if (disabled || solved) return;
            const rect = event.currentTarget.getBoundingClientRect();
            onGuess((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
          }}
          src={mapPuzzle.map.imageUrl}
        />
        {guesses.map((guess, index) => (
          <span
            className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--ember-bright)] bg-[var(--ember)]/70 shadow-[0_0_12px_rgba(255,120,40,0.85)]"
            key={`${guess.x}-${guess.y}-${index}`}
            style={{ left: `${guess.x * 100}%`, top: `${guess.y * 100}%` }}
          />
        ))}
      </div>

      <div className="space-y-2">
        {guesses.map((guess, index) => (
          <div
            className="border border-[var(--panel-ink)]/25 bg-[var(--panel)]/45 px-3 py-2 font-mono uppercase text-[var(--panel-ink)]"
            key={index}
          >
            <div className="text-[10pt] tracking-[0.12em] opacity-65">
              {dict.ui.mapAttempt.replace("{n}", String(index + 1))}
            </div>
            <div className="mt-1 text-2xl leading-none text-[var(--rust)]">{guess.distanceMeters} m</div>
          </div>
        ))}
      </div>
    </div>
  );
}
