"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { autocompleteNpc, resolveNpcByInput } from "@/src/core/autocomplete";
import { shareResult } from "@/src/core/share";
import { sendResult } from "@/src/core/telemetry";
import type { Locale, Npc, PlayerCamp, Quote } from "@/src/core/types";
import { npcDisplayName, npcPool } from "@/src/data";
import { getDictionary } from "@/src/i18n";
import { MANHUNT_CONFIG } from "@/src/modes/manhunt/config";
import { manhuntFieldValue, manhuntPortraitUrl } from "@/src/modes/manhunt/fields";
import { manhuntPurseLabel } from "@/src/modes/manhunt/nuggets";
import { buildManhuntShareText } from "@/src/modes/manhunt/share";
import {
  isFieldRevealed,
  isFullyRevealed,
  loadManhuntState,
  recordManhuntMiss,
  recordManhuntReveal,
  recordManhuntStatsWin,
  recordManhuntWin,
  saveManhuntState,
  saveManhuntStats,
} from "@/src/modes/manhunt/state";
import type { ManhuntFieldId, ManhuntState } from "@/src/modes/manhunt/types";
import {
  trackManhuntMiss,
  trackManhuntReveal,
  trackManhuntShare,
  trackManhuntStart,
  trackManhuntWin,
  trackManhuntZero,
} from "@/src/modes/manhunt/telemetry";
import { hunterLevelAfterGain, telemetryAttemptsFromNuggets, xpForManhunt } from "@/src/modes/manhunt/xp";

const ORE_ICON = "/ruda.webp";

function NuggetIcon({ className = "size-5" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" aria-hidden="true" className={`object-contain ${className}`} src={ORE_ICON} />
  );
}

function NuggetPurse({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {Array.from({ length: count }, (_, index) => (
        <NuggetIcon key={index} />
      ))}
    </div>
  );
}

function maybeTrackZero(
  previous: ManhuntState,
  next: ManhuntState,
  zeroSentRef: { current: boolean },
  puzzle: number,
  camp: PlayerCamp | null,
  userId: string | null,
) {
  if (zeroSentRef.current) return;
  if (previous.nuggets > 0 && next.nuggets === 0 && next.status === "playing") {
    zeroSentRef.current = true;
    trackManhuntZero(puzzle, next.revealCount, next.misses.length, camp, userId);
  }
}

function fieldValueClass(field: ManhuntFieldId, multiline: boolean) {
  const base = "mt-1.5 font-serif leading-snug text-[var(--panel-ink)]";
  if (field === "quote" || multiline) {
    return `${base} whitespace-pre-wrap text-base sm:text-lg`;
  }
  return `${base} text-lg sm:text-xl`;
}

export function ManhuntMode({
  targetNpc,
  targetQuote,
  puzzle,
  lang,
  camp,
  userId,
  totalXp,
  onXpGain,
  onWin,
}: {
  targetNpc: Npc;
  targetQuote: Quote | null;
  puzzle: number;
  lang: Locale;
  camp: PlayerCamp | null;
  userId: string | null;
  totalXp: number;
  onXpGain: (amount: number) => void;
  onWin: () => void;
}) {
  const dict = getDictionary(lang);
  const mh = dict.ui.manhunt;
  const [state, setState] = useState<ManhuntState>(() => loadManhuntState(puzzle));
  const [input, setInput] = useState("");
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [shareDone, setShareDone] = useState(false);
  const [xpAwarded, setXpAwarded] = useState<number | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const winAwardedRef = useRef(false);
  const startSentRef = useRef(false);
  const zeroSentRef = useRef(false);

  const fullyRevealed = isFullyRevealed(state);
  const portraitRevealed = state.status === "won" || fullyRevealed;
  const portraitUrl = manhuntPortraitUrl(targetNpc, portraitRevealed);
  const campLine = manhuntFieldValue("camp", targetNpc, targetQuote, lang);
  const brokeOpen = state.nuggets === 0 && state.status === "playing";

  useEffect(() => {
    const loaded = loadManhuntState(puzzle);
    setState(loaded);
    setInput("");
    setShareDone(false);
    setXpAwarded(null);
    setLevelUp(null);
    winAwardedRef.current = loaded.status === "won";
    startSentRef.current = loaded.revealCount > 0 || loaded.misses.length > 0 || loaded.status === "won";
    zeroSentRef.current = loaded.nuggets === 0 && loaded.status === "playing";
  }, [puzzle, targetNpc.id]);

  useEffect(() => {
    saveManhuntState(state);
  }, [state]);

  useEffect(() => {
    if (startSentRef.current || state.status !== "playing") return;
    if (state.revealCount > 0 || state.misses.length > 0) return;
    startSentRef.current = true;
    trackManhuntStart(puzzle, camp, userId);
  }, [camp, puzzle, state.misses.length, state.revealCount, state.status, userId]);

  const suggestions = useMemo(
    () => autocompleteNpc(npcPool, input, state.misses),
    [input, state.misses],
  );

  const resolvedInput = useMemo(() => resolveNpcByInput(npcPool, input), [input]);
  const canAccuse = Boolean(resolvedInput) && state.status !== "won" && state.nuggets > 0;

  function vibrate() {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(15);
    }
  }

  function handleReveal(field: ManhuntFieldId) {
    setState((current) => {
      const next = recordManhuntReveal(current, field);
      if (!next) return current;
      vibrate();
      trackManhuntReveal(puzzle, field, next.revealCount, next.nuggets, camp, userId);
      maybeTrackZero(current, next, zeroSentRef, puzzle, camp, userId);
      return next;
    });
  }

  function finishWin(nextState: ManhuntState) {
    if (winAwardedRef.current) return;
    winAwardedRef.current = true;

    const score = nextState.nuggets;
    const xpEarned = xpForManhunt(score);
    const stats = recordManhuntStatsWin(puzzle, score);
    saveManhuntStats(stats);
    setXpAwarded(xpEarned);
    setLevelUp(hunterLevelAfterGain(totalXp, xpEarned));
    onXpGain(xpEarned);

    const ms = Math.max(0, Date.now() - (nextState.startedAt ?? Date.now()));
    trackManhuntWin(puzzle, score, nextState.revealCount, nextState.misses.length, ms, camp, userId);

    sendResult({
      mode: "manhunt",
      puzzle,
      attempts: telemetryAttemptsFromNuggets(score),
      solved: true,
      camp,
      userId,
    });
    onWin();
  }

  function handleAccuse(npc?: Npc) {
    const resolved = npc ?? resolvedInput;
    if (!resolved || state.status === "won" || state.nuggets === 0) return;
    if (state.misses.includes(resolved.id)) return;

    if (resolved.id === targetNpc.id) {
      setState((current) => {
        const won = recordManhuntWin(current);
        finishWin(won);
        return won;
      });
      return;
    }

    setState((current) => {
      const next = recordManhuntMiss(current, resolved.id);
      if (!next) return current;
      vibrate();
      trackManhuntMiss(puzzle, next.misses.length, next.nuggets, camp, userId);
      maybeTrackZero(current, next, zeroSentRef, puzzle, camp, userId);
      return next;
    });
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((current) => Math.min(current + 1, suggestions.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter" && canAccuse) {
      event.preventDefault();
      const selected = suggestions[activeSuggestion];
      handleAccuse(selected ?? resolvedInput ?? undefined);
    }
  }

  async function handleShare() {
    const text = buildManhuntShareText({
      puzzle,
      score: state.nuggets,
      reveals: state.revealCount,
      misses: state.misses.length,
      lang,
    });
    const result = await shareResult(text);
    setShareDone(true);
    trackManhuntShare(puzzle, state.nuggets, camp, userId);
    if (result === "copied") {
      // parent may show toast
    }
  }

  const missNames = state.misses
    .map((id) => {
      const npc = npcPool.find((entry) => entry.id === id);
      return npc ? npcDisplayName(npc, lang) : null;
    })
    .filter((name): name is string => Boolean(name));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-[var(--panel-ink)]/20 pb-4 sm:flex-row sm:items-end sm:justify-end">
        <div className="text-left sm:text-right">
          <div className="font-mono text-[10pt] uppercase tracking-[0.14em] text-[var(--panel-ink)]/70">
            {manhuntPurseLabel(state.nuggets, lang)}
          </div>
          <NuggetPurse count={state.nuggets} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <article className="border-2 border-[var(--panel-ink)]/30 bg-[var(--panel)]/70 p-4 sm:p-5">
          <div className="mb-3 border-b border-[var(--panel-ink)]/15 pb-3">
            <div className="font-mono text-[10pt] uppercase tracking-[0.16em] text-[var(--rust)]">
              {mh.wanted} №{puzzle}
            </div>
          </div>

          <div className="mx-auto max-w-[230px]">
            <div className="relative aspect-[3/4] overflow-hidden border border-[var(--panel-ink)]/35 bg-[var(--panel-ink)]/8">
              {portraitUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="size-full object-cover object-top opacity-95" src={portraitUrl} />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-2 bg-[var(--panel-ink)]/5 text-[var(--panel-ink)]/45">
                  <span className="text-6xl font-serif">{mh.unknownPortrait}</span>
                  <span className="px-3 text-center font-mono text-[9pt] uppercase tracking-[0.12em]">
                    {mh.portraitUnknown}
                  </span>
                </div>
              )}
            </div>
          </div>

          <p className="mt-4 font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--rust)]">{campLine}</p>
          <p className="mt-3 font-serif text-sm italic leading-relaxed text-[var(--panel-ink)]/80">{mh.wantedFlavor}</p>

          <div
            aria-hidden="true"
            className="pointer-events-none mt-4 flex size-14 items-center justify-center self-end rounded-full border-2 border-[var(--rust)]/60 text-center font-mono text-[7pt] uppercase leading-tight tracking-[0.08em] text-[var(--rust)]"
          >
            {mh.guardsSeal}
          </div>

          {brokeOpen ? (
            <div className="mt-4 border border-[var(--rust)]/40 bg-[var(--rust)]/10 p-4 text-center">
              <p className="font-mono text-[10pt] uppercase tracking-[0.14em] text-[var(--rust)]">{mh.brokeTitle}</p>
              <p className="mt-2 font-serif text-base leading-relaxed text-[var(--panel-ink)]">{mh.brokeBody}</p>
            </div>
          ) : null}

          {state.status === "won" && xpAwarded !== null ? (
            <div className="mt-4 space-y-1 border border-[var(--ember)]/35 bg-[var(--ember)]/10 p-4 text-center font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--panel-ink)]">
              <p className="text-[var(--ember-bright)]">
                {mh.experience}: +{xpAwarded} XP
              </p>
              {levelUp ? <p>{mh.levelUp.replace("{n}", String(levelUp))}</p> : null}
            </div>
          ) : null}
        </article>

        <div className="divide-y divide-[var(--panel-ink)]/15 border border-[var(--panel-ink)]/20 bg-[var(--panel)]/40">
          {MANHUNT_CONFIG.fields.map((field) => {
            const revealed = isFieldRevealed(state, field.id) || fullyRevealed;
            const value = manhuntFieldValue(field.id, targetNpc, targetQuote, lang);
            const label = mh.fields[field.id];
            const multiline = value.includes("\n");

            return (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-3 py-3.5" key={field.id}>
                <div className="min-w-0">
                  <div className="font-mono text-[9pt] uppercase tracking-[0.12em] text-[var(--panel-ink)]/60">
                    {label}
                  </div>
                  {revealed ? <div className={fieldValueClass(field.id, multiline)}>{value}</div> : null}
                </div>
                {!revealed ? (
                  <button
                    className="mt-0.5 flex shrink-0 items-center gap-1.5 border border-[var(--panel-ink)]/45 bg-[var(--panel-ink)] px-3 py-2 font-mono text-[9pt] uppercase tracking-[0.1em] text-[var(--panel)] transition-colors hover:border-[var(--rust)] hover:bg-[var(--rust)] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={field.cost > state.nuggets || state.status === "won"}
                    onClick={() => handleReveal(field.id)}
                    type="button"
                  >
                    {mh.bribe}
                    <NuggetIcon className="size-4" />
                    {field.cost}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="min-h-[4rem] border border-dashed border-[var(--panel-ink)]/25 bg-[var(--panel)]/25 p-4">
        <div className="mb-2 font-mono text-[9pt] uppercase tracking-[0.14em] text-[var(--panel-ink)]/55">
          {mh.eliminated}
        </div>
        {missNames.length > 0 ? (
          <p className="font-serif text-base italic text-[var(--panel-ink)]/75">
            {missNames.map((name) => (
              <span className="mr-3 line-through decoration-[var(--rust)]/60" key={name}>
                {name}
              </span>
            ))}
          </p>
        ) : null}
      </div>

      {state.status === "won" ? (
        <button
          className="min-h-12 w-full border border-[var(--panel-ink)] bg-[var(--panel-ink)] px-5 py-3 font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--panel)] transition-colors hover:bg-[var(--rust)] sm:w-auto"
          onClick={() => void handleShare()}
          type="button"
        >
          {shareDone ? dict.ui.shareShared : dict.ui.share}
        </button>
      ) : brokeOpen ? null : (
        <div className="relative">
          <div className="flex flex-col border-2 border-[var(--panel-ink)]/70 bg-[var(--panel)]/60 sm:flex-row">
            <div className="flex min-w-0 flex-1">
              <span className="px-3 py-3 text-xl text-[var(--rust)] sm:px-4 sm:text-2xl">⟶</span>
              <input
                className="min-h-14 min-w-0 flex-1 bg-transparent py-3 pr-3 text-lg text-[var(--panel-ink)] outline-none placeholder:text-[var(--panel-ink)]/40 placeholder:italic sm:text-xl"
                onChange={(event) => {
                  setInput(event.target.value);
                  setActiveSuggestion(0);
                }}
                onKeyDown={handleInputKeyDown}
                placeholder={mh.guessPlaceholder}
                type="text"
                value={input}
              />
            </div>
            <button
              className="min-h-12 border-t border-[var(--panel-ink)]/30 bg-[var(--panel-ink)] px-4 font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--panel)] transition-colors hover:bg-[var(--rust)] disabled:opacity-40 sm:min-h-0 sm:self-stretch sm:border-l sm:border-t-0 sm:px-6"
              disabled={!canAccuse}
              onClick={() => handleAccuse()}
              type="button"
            >
              {mh.accuse}
            </button>
          </div>

          {suggestions.length > 0 ? (
            <ul className="kolonia-scroll absolute z-50 mt-1 max-h-[min(20rem,45vh)] w-full overflow-y-auto border border-[var(--panel-ink)]/30 bg-[var(--panel)] shadow-lg">
              {suggestions.map((npc, index) => (
                <li key={npc.id}>
                  <button
                    className={`block min-h-11 w-full px-4 py-2 text-left font-serif text-lg text-[var(--panel-ink)] ${
                      index === activeSuggestion ? "bg-[var(--panel-ink)]/10" : ""
                    }`}
                    onClick={() => handleAccuse(npc)}
                    type="button"
                  >
                    {npcDisplayName(npc, lang)}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
