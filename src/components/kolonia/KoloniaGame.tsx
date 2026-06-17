"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { autocompleteNpc, resolveNpcByInput } from "@/src/core/autocomplete";
import {
  consumeGoogleAuthHash,
  fetchProfile,
  loadAuth,
  mergePersistedWithProfile,
  saveAuth,
  syncProfile,
  startGoogleLogin,
  type AuthSession,
} from "@/src/core/auth";
import { fetchDayStats, type DayStats } from "@/src/core/day-stats";
import { dailyItem, formatCountdown, msUntilReset, puzzleNumber } from "@/src/core/daily";
import {
  fallbackDailyMap,
  submitMapGuess,
} from "@/src/core/daily-api";
import { classicFeedback, quoteFeedback } from "@/src/core/feedback";
import { syncProgressToServer } from "@/src/core/progress";
import { buildShareText, shareResult } from "@/src/core/share";
import {
  averageAttempts,
  effectiveness,
  ensureModeDay,
  ensureModeStats,
  loadPersisted,
  markHelpSeen,
  recordGuess,
  recordMapGuess,
  setCamp,
  setLanguage,
} from "@/src/core/storage";
import { useDailyPuzzles } from "@/src/core/use-daily-puzzles";
import { xpForSolve } from "@/src/core/xp";
import { sendResult, sendShareEvent } from "@/src/core/telemetry";
import { CONTACT_EMAIL } from "@/src/core/site";
import { useHydrated, usePersisted } from "@/src/core/use-persisted";
import type { FeedbackCell, Locale, ModeId, Npc, PlayerCamp, Quote } from "@/src/core/types";
import { getNpcById, npcDisplayName, npcPool, quotePool } from "@/src/data";
import {
  campLabel,
  getDictionary,
  guildLabel,
  npcLocationLabel,
  playerCampLabel,
  rankLabel,
} from "@/src/i18n";
import { quoteHints } from "@/src/modes/quote/hints";
import { MapMode } from "./MapMode";
import { HelpModal, ResultModal, SettingsModal } from "./modals";
import { Line, Panel, ParchmentPanel, Pip, Stat } from "./ui";

const PLAYER_CAMPS: PlayerCamp[] = ["OLD_CAMP", "NEW_CAMP", "SWAMP_CAMP"];
const FACEBOOK_GROUP_URL = "https://www.facebook.com/groups/2289912291540748";
const FEEDBACK_COLUMN_KEYS = ["guild", "guildFamily", "location", "isTeacher", "isFriend"] as const;

const CAMP_THEMES: Record<PlayerCamp, { id: string; imageUrl: string }> = {
  OLD_CAMP: { id: "I", imageUrl: "/camps/old-camp.png" },
  NEW_CAMP: { id: "II", imageUrl: "/camps/new-camp.png" },
  SWAMP_CAMP: { id: "III", imageUrl: "/camps/swamp-camp.png" },
};

export default function KoloniaGame() {
  const [persisted, setPersisted] = usePersisted();
  const hydrated = useHydrated();
  const [mode, setMode] = useState<ModeId>("classic");
  const [input, setInput] = useState("");
  const [resetMs, setResetMs] = useState(msUntilReset());
  const [toast, setToast] = useState<string | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [helpManualOpen, setHelpManualOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [resultContext, setResultContext] = useState<{
    mode: ModeId;
    attempts: number;
    npc: Npc;
    streak: number;
    xpEarned: number;
    distanceMeters?: number | null;
    stats: DayStats | null;
    statsLoading: boolean;
  } | null>(null);

  const puzzle = puzzleNumber();
  const { classicNpc: scheduledClassic, quote: scheduledQuote, mapPuzzle, cardNpc: scheduledCard, loading: dailyLoading } =
    useDailyPuzzles(puzzle);
  const dict = getDictionary(persisted.lang);
  const classicTarget = useMemo(
    () => scheduledClassic ?? dailyItem(npcPool, puzzle, "classic"),
    [puzzle, scheduledClassic],
  );
  const quoteTarget = useMemo(
    () => scheduledQuote ?? dailyItem(quotePool, puzzle, "quote"),
    [puzzle, scheduledQuote],
  );
  const mapTarget = useMemo(
    () => mapPuzzle ?? fallbackDailyMap(puzzle),
    [mapPuzzle, puzzle],
  );
  const cardTarget = useMemo(
    () => scheduledCard ?? dailyItem(npcPool, puzzle, "card"),
    [puzzle, scheduledCard],
  );
  const targetNpc = useMemo(() => {
    if (mode === "map") {
      const id = mapTarget?.npcId;
      return id ? getNpcById(id) : undefined;
    }
    const targetId = mode === "classic" ? classicTarget?.id : mode === "card" ? cardTarget?.id : quoteTarget?.npcId;
    return targetId ? getNpcById(targetId) : undefined;
  }, [cardTarget, classicTarget, mapTarget, mode, quoteTarget]);

  const modeDay = ensureModeDay(persisted, mode);
  const classicDay = ensureModeDay(persisted, "classic");
  const quoteDay = ensureModeDay(persisted, "quote");
  const mapDay = ensureModeDay(persisted, "map");
  const cardDay = ensureModeDay(persisted, "card");
  const modeStats = ensureModeStats(persisted, mode);
  const quoteStats = ensureModeStats(persisted, "quote");
  const suggestions = useMemo(
    () => autocompleteNpc(npcPool, input, modeDay.guesses),
    [input, modeDay.guesses],
  );

  const guessRows = useMemo(() => {
    return modeDay.guesses
      .map((npcId) => {
        const npc = getNpcById(npcId);
        if (!npc || !targetNpc) return null;
        const feedback =
          mode === "classic" ? classicFeedback(npc, targetNpc) : quoteFeedback(npc, targetNpc);
        const debug = FEEDBACK_COLUMN_KEYS.map((key) =>
          feedbackDebugTitle(key, npc, targetNpc, persisted.lang),
        );
        return { npcId, name: npcDisplayName(npc, persisted.lang), feedback, debug };
      })
      .filter(
        (row): row is { npcId: string; name: string; feedback: FeedbackCell[]; debug: string[] } =>
          Boolean(row),
      );
  }, [mode, modeDay.guesses, persisted.lang, targetNpc]);

  const quoteHintList =
    mode === "quote" && targetNpc ? quoteHints(modeDay.guesses.length, targetNpc, persisted.lang) : [];
  const showHelp = helpManualOpen || (hydrated && Boolean(persisted.camp) && !persisted.seenHelp);
  const isAdmin = Boolean(authSession && adminUserId === authSession.userId);

  useEffect(() => {
    const timer = window.setInterval(() => setResetMs(msUntilReset()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    document.documentElement.lang = persisted.lang;
  }, [persisted.lang]);

  useEffect(() => {
    if (!hydrated) return;

    const timeoutId = window.setTimeout(() => {
      const authDict = getDictionary(loadPersisted().lang);
      const googleLogin = consumeGoogleAuthHash();
      if (googleLogin?.kind === "error") {
        const message =
          authDict.ui.authErrors[googleLogin.code as keyof typeof authDict.ui.authErrors] ??
          authDict.ui.authErrors.unavailable;
        setToast(message);
      }

      const session = googleLogin?.kind === "session" ? googleLogin.session : loadAuth();
      setAuthSession(session);
      if (!session) return;

      void (async () => {
        if (googleLogin?.kind === "session" && googleLogin.isNew) {
          await syncProfile(session.token, loadPersisted());
        }

        const profile = await fetchProfile(session.token);
        if (!profile) return;
        setPersisted((current) => mergePersistedWithProfile(current, profile));
      })();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [hydrated, setPersisted]);

  useEffect(() => {
    if (!authSession) return;

    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/admin/me", {
        headers: { Authorization: `Bearer ${authSession.token}` },
      });
      if (cancelled) return;
      if (!response.ok) {
        setAdminUserId(null);
        return;
      }
      const data = (await response.json()) as { userId: string };
      setAdminUserId(data.userId);
    })();

    return () => {
      cancelled = true;
    };
  }, [authSession]);

  function showToast(message: string) {
    setToast(message);
  }

  function openWinModal(options: {
    mode: ModeId;
    attempts: number;
    npc: Npc;
    streak: number;
    xpEarned: number;
    distanceMeters?: number | null;
    nextState?: typeof persisted;
  }) {
    showToast(dict.ui.solved);
    setResultContext({
      mode: options.mode,
      attempts: options.attempts,
      npc: options.npc,
      streak: options.streak,
      xpEarned: options.xpEarned,
      distanceMeters: options.distanceMeters,
      stats: null,
      statsLoading: options.mode !== "map",
    });

    if (options.mode !== "map") {
      sendResult({
        mode: options.mode,
        puzzle,
        attempts: options.attempts,
        solved: true,
        camp: persisted.camp,
        userId: loadAuth()?.userId ?? null,
      });

      void fetchDayStats(options.mode, puzzle, options.attempts).then((stats) => {
        setResultContext((current) =>
          current?.mode === options.mode && current.attempts === options.attempts
            ? { ...current, stats, statsLoading: false }
            : current,
        );
      });
    }

    const session = loadAuth();
    if (session && options.nextState) {
      void syncProfile(session.token, options.nextState);
      void syncProgressToServer(session.token, options.nextState, {
        mode: options.mode,
        puzzle,
        attempts: options.attempts,
        xpEarned: options.xpEarned,
        distanceMeters: options.distanceMeters,
      });
    }
  }

  function submitGuess(npc?: Npc) {
    if (!targetNpc || modeDay.solved) return;

    const resolved = npc ?? resolveNpcByInput(npcPool, input);
    if (!resolved) {
      showToast(dict.ui.unknownNpc);
      return;
    }
    if (modeDay.guesses.includes(resolved.id)) {
      showToast(dict.ui.alreadyGuessed);
      return;
    }

    const solved = resolved.id === targetNpc.id;
    const nextState = recordGuess(persisted, mode, resolved.id, solved);
    setPersisted(nextState);
    setInput("");
    setActiveSuggestion(0);

    if (solved) {
      const attempts = nextState.modes[mode]?.guesses.length ?? 0;
      openWinModal({
        mode,
        attempts,
        npc: targetNpc,
        streak: ensureModeStats(nextState, mode).streak,
        xpEarned: xpForSolve(attempts),
        nextState,
      });
    }
  }

  async function handleMapGuess(x: number, y: number) {
    if (!mapTarget || !targetNpc || modeDay.solved || mode !== "map") return;

    try {
      const result = await submitMapGuess(puzzle, x, y);
      const guess = { x, y, distanceMeters: result.distanceMeters };
      const attempts = (modeDay.mapGuesses?.length ?? 0) + 1;
      const xpEarned = result.solved ? xpForSolve(attempts) : 0;
      const nextState = recordMapGuess(persisted, guess, result.solved, xpEarned);
      setPersisted(nextState);

      if (result.solved) {
        openWinModal({
          mode: "map",
          attempts,
          npc: targetNpc,
          streak: ensureModeStats(nextState, "map").streak,
          xpEarned,
          distanceMeters: result.distanceMeters,
          nextState,
        });
      } else {
        showToast(dict.ui.mapMiss.replace("{n}", String(result.distanceMeters)));
      }
    } catch {
      showToast(dict.ui.mapGuessFailed);
    }
  }

  async function handleShare() {
    if (!modeDay.solved) return;

    const text = buildShareText({
      puzzle,
      mode,
      attempts: modeDay.guesses.length,
      streak: modeStats.streak,
      rows: guessRows.map((row) => row.feedback),
      lang: persisted.lang,
    });

    const result = await shareResult(text);
    sendShareEvent({
      mode,
      puzzle,
      attempts: modeDay.guesses.length,
      camp: persisted.camp,
      userId: loadAuth()?.userId ?? null,
    });
    showToast(result === "shared" ? dict.ui.shareShared : dict.ui.copied);
  }

  function handleCampSelect(camp: PlayerCamp) {
    setPersisted((current) => setCamp(current, camp));
  }

  function handleLanguageChange(lang: Locale) {
    setPersisted((current) => setLanguage(current, lang));
  }

  function closeHelp() {
    setHelpManualOpen(false);
    setPersisted((current) => markHelpSeen(current));
  }

  function handleGoogleLogin() {
    const session = loadAuth();
    if (session) {
      void syncProfile(session.token, persisted);
    }
    startGoogleLogin();
  }

  function handleLogout() {
    saveAuth(null);
    setAuthSession(null);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((current) => Math.min(current + 1, Math.max(suggestions.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = suggestions[activeSuggestion];
      if (selected) {
        submitGuess(selected);
      } else {
        submitGuess();
      }
    }
  }

  if (!hydrated || dailyLoading || !targetNpc) {
    return <div className="min-h-screen bg-[var(--background)]" />;
  }

  const playerCamp = persisted.camp;
  const weekLabel = `${dict.ui.week} ${Math.floor(puzzle / 7) + 1}`;
  const gridTemplate =
    "grid-cols-[2rem_minmax(10rem,1fr)_repeat(5,minmax(5.5rem,6.5rem))]";
  const guessTable = (
    <>
      <div className="mt-6 space-y-3 sm:hidden">
        {guessRows.map((row, index) => (
          <div
            className="border border-[var(--panel-ink)]/20 bg-[var(--panel)]/35 p-3"
            key={row.npcId}
          >
            <div className="mb-3 flex min-w-0 items-baseline gap-2 border-b border-[var(--panel-ink)]/15 pb-2">
              <span className="shrink-0 font-mono text-[10pt] text-[var(--panel-ink)]/50">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 truncate text-base italic text-[var(--panel-ink)]">{row.name}</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {row.feedback.map((cell, cellIndex) => {
                const columnKey = FEEDBACK_COLUMN_KEYS[cellIndex];
                return (
                <div className="flex flex-col items-center gap-1.5" key={`${row.npcId}-${cellIndex}`}>
                  <span
                    className="cursor-help text-center font-mono text-[8pt] uppercase leading-tight tracking-normal text-[var(--panel-ink)]/55 underline decoration-dotted decoration-[var(--panel-ink)]/25 underline-offset-2"
                    title={dict.ui.columnHints[columnKey]}
                  >
                    {dict.ui.columns[columnKey]}
                  </span>
                  <Pip
                    cell={cell}
                    debugTitle={isAdmin ? row.debug[cellIndex] : undefined}
                  />
                </div>
              );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="kolonia-scroll mt-6 hidden overflow-x-auto pb-2 sm:mt-8 sm:block">
        <div className="min-w-[48rem]">
          <div
            className={`grid gap-2 border-b border-[var(--panel-ink)]/20 pb-2 font-mono text-[10pt] uppercase tracking-normal text-[var(--panel-ink)]/55 ${gridTemplate}`}
          >
            <span>#</span>
            <span>{dict.ui.candidate}</span>
            {FEEDBACK_COLUMN_KEYS.map((key) => (
              <span
                className="cursor-help text-center underline decoration-dotted decoration-[var(--panel-ink)]/25 underline-offset-2"
                key={key}
                title={dict.ui.columnHints[key]}
              >
                {dict.ui.columns[key]}
              </span>
            ))}
          </div>
          <ol className="divide-y divide-[var(--panel-ink)]/15">
            {guessRows.map((row, index) => (
              <li className={`grid items-center gap-2 py-3 ${gridTemplate}`} key={row.npcId}>
                <span className="font-mono text-[10pt] text-[var(--panel-ink)]/50">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="truncate text-base italic text-[var(--panel-ink)] sm:text-lg">{row.name}</span>
                {row.feedback.map((cell, cellIndex) => (
                  <Pip
                    cell={cell}
                    debugTitle={isAdmin ? row.debug[cellIndex] : undefined}
                    key={`${row.npcId}-${cellIndex}`}
                  />
                ))}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[var(--background)] font-serif text-[var(--foreground)] selection:bg-[var(--ember)]/40">
      <Background />
      <Header
        dict={dict}
        lang={persisted.lang}
        puzzle={puzzle}
        resetLabel={formatCountdown(resetMs)}
        onLanguageChange={handleLanguageChange}
        onOpenHelp={() => setHelpManualOpen(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <main className="relative z-10 flex-1 px-3 py-5 sm:px-4 sm:py-8 lg:px-8 lg:py-10 2xl:px-10">
        <div className="mx-auto grid max-w-[1680px] grid-cols-12 gap-4 sm:gap-6 2xl:grid-cols-[minmax(190px,0.8fr)_minmax(0,1.7fr)_minmax(190px,0.8fr)]">
          <section className="order-1 col-span-12 min-w-0 2xl:col-span-1 2xl:col-start-2 2xl:row-start-1" aria-label={dict.ui.puzzle}>
            <ParchmentPanel>
              <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-5 sm:flex sm:flex-wrap">
                {(["classic", "quote", "map", "card"] as const).map((modeId) => {
                  const day =
                    modeId === "quote" ? quoteDay : modeId === "classic" ? classicDay : modeId === "card" ? cardDay : mapDay;
                  const badgeLabel = day.solved
                    ? dict.ui.modeSolved
                    : day.guesses.length > 0
                      ? dict.ui.modeStarted
                      : null;
                  const badge = day.solved ? "✅" : day.guesses.length > 0 ? "●" : "";
                  return (
                    <button
                      aria-label={
                        badgeLabel
                          ? `${modeId === "quote" ? dict.ui.modeQuote : modeId === "classic" ? dict.ui.modeClassic : modeId === "card" ? dict.ui.modeCard : dict.ui.modeMap} — ${badgeLabel}`
                          : modeId === "quote"
                            ? dict.ui.modeQuote
                            : modeId === "classic"
                              ? dict.ui.modeClassic
                              : modeId === "card"
                                ? dict.ui.modeCard
                                : dict.ui.modeMap
                      }
                      className={`flex min-h-11 w-full items-center justify-center gap-2 border px-3 py-2 font-mono text-[10pt] uppercase tracking-[0.12em] sm:w-auto sm:justify-start ${
                        mode === modeId
                          ? "border-[var(--rust)] bg-[var(--panel-ink)] text-[var(--panel)]"
                          : "border-[var(--panel-ink)]/30 text-[var(--panel-ink)]/70"
                      }`}
                      key={modeId}
                      onClick={() => setMode(modeId)}
                      type="button"
                    >
                      <span>
                        {modeId === "quote"
                          ? dict.ui.modeQuote
                          : modeId === "classic"
                            ? dict.ui.modeClassic
                            : modeId === "card"
                              ? dict.ui.modeCard
                              : dict.ui.modeMap}
                      </span>
                      {badge ? (
                        <span aria-hidden="true" title={badgeLabel ?? undefined}>
                          {badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="mb-5 flex flex-col gap-3 border-b border-[var(--panel-ink)]/30 pb-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--rust)]">
                    {dict.ui.puzzle} №{puzzle} ·{" "}
                    {mode === "quote"
                      ? dict.ui.quoteOfDay
                      : mode === "classic"
                        ? dict.ui.classicOfDay
                        : mode === "card"
                          ? dict.ui.cardOfDay
                          : dict.ui.mapOfDay}
                  </div>
                  <h1 className="mt-2 text-[1.35rem] leading-tight tracking-tight text-[var(--panel-ink)] sm:text-[25pt]">
                    {mode === "quote"
                      ? dict.ui.whoSaid
                      : mode === "classic"
                        ? dict.ui.whoIsNpc
                        : mode === "card"
                          ? dict.ui.whoIsCard
                          : dict.ui.whereIsNpc}
                  </h1>
                  {mode === "map" && mapTarget ? (
                    <p className="mt-4 inline-block border border-[var(--rust)]/40 bg-[var(--panel-ink)]/10 px-4 py-2 font-serif text-3xl font-semibold leading-none text-[var(--rust)] shadow-sm sm:text-4xl">
                      {mapTarget.npcName[persisted.lang] ?? mapTarget.npcName.pl}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-end justify-between gap-4 sm:block sm:text-right">
                  <div className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--panel-ink)]/70">
                    {dict.ui.attempt}
                  </div>
                  <div className={`${mode === "map" ? "text-4xl sm:text-6xl" : "text-3xl sm:text-4xl"} leading-none text-[var(--panel-ink)]`}>
                    {mode === "map" ? (modeDay.mapGuesses?.length ?? 0) : modeDay.guesses.length}
                    {modeDay.solved ? "" : <span className="text-lg opacity-40"> / ∞</span>}
                  </div>
                </div>
              </div>

              {mode === "quote" ? (
                <QuoteDialogue quote={quoteTarget} lang={persisted.lang} dict={dict} />
              ) : null}

              {mode === "map" && mapTarget ? (
                <MapMode
                  disabled={modeDay.solved}
                  guesses={modeDay.mapGuesses ?? []}
                  lang={persisted.lang}
                  mapPuzzle={mapTarget}
                  onGuess={(x, y) => void handleMapGuess(x, y)}
                  solved={modeDay.solved}
                />
              ) : null}

              {mode === "card" && cardTarget ? (
                <CharacterCard npc={cardTarget} lang={persisted.lang} revealed={modeDay.solved || isAdmin} />
              ) : null}

              {mode !== "map" && quoteHintList.length > 0 ? (
                <div className="mb-5 space-y-2 border border-[var(--panel-ink)]/20 bg-[var(--panel)]/40 p-3 sm:mb-6">
                  {quoteHintList.map((hint) => (
                    <p className="font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--panel-ink)]/80" key={hint.id}>
                      {hint.text}
                    </p>
                  ))}
                </div>
              ) : null}

              {mode !== "map" ? (
              <>
              {!modeDay.solved ? (
                <div className="relative">
                  <div className="flex flex-col border-2 border-[var(--panel-ink)]/70 bg-[var(--panel)]/60 sm:flex-row">
                    <div className="flex min-w-0 flex-1">
                      <span className="px-3 py-3 text-xl text-[var(--rust)] sm:px-4 sm:text-2xl">⟶</span>
                      <input
                        className="min-h-14 min-w-0 flex-1 bg-transparent py-3 pr-3 text-lg text-[var(--panel-ink)] outline-none placeholder:text-[var(--panel-ink)]/40 placeholder:italic sm:text-2xl"
                        onChange={(event) => {
                          setInput(event.target.value);
                          setActiveSuggestion(0);
                        }}
                        onKeyDown={handleInputKeyDown}
                        placeholder={dict.ui.guessPlaceholder}
                        type="text"
                        value={input}
                      />
                    </div>
                    <button
                      className="min-h-12 border-t border-[var(--panel-ink)]/30 bg-[var(--panel-ink)] px-4 font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--panel)] transition-colors hover:bg-[var(--rust)] sm:min-h-0 sm:self-stretch sm:border-l sm:border-t-0 sm:px-6"
                      onClick={() => submitGuess()}
                      type="button"
                    >
                      {dict.ui.guess}
                    </button>
                  </div>

                  {suggestions.length > 0 ? (
                    <ul className="kolonia-scroll absolute z-50 mt-1 max-h-[min(24rem,50vh)] w-full overflow-y-auto border border-[var(--panel-ink)]/30 bg-[var(--panel)] shadow-lg">
                      {suggestions.map((npc, index) => (
                        <li key={npc.id}>
                          <button
                            className={`block min-h-11 w-full px-4 py-2 text-left font-serif text-lg text-[var(--panel-ink)] ${
                              index === activeSuggestion ? "bg-[var(--panel-ink)]/10" : ""
                            }`}
                            onClick={() => submitGuess(npc)}
                            type="button"
                          >
                            <span className="block">{npcDisplayName(npc, persisted.lang)}</span>
                            <span className="block truncate font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--panel-ink)]/55">
                              {guildLabel(persisted.lang, npc.guild)} · {campLabel(persisted.lang, npc.guildFamily)} ·{" "}
                              {npcLocationLabel(persisted.lang, npc)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {guessTable}
              </>
              ) : null}

              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {mode !== "map" ? (
                <div className="grid grid-cols-3 gap-2 font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--panel-ink)]/60 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
                  <span className="flex items-center gap-2">
                    <span className="size-3 bg-[var(--moss)]" />
                    {dict.ui.hit}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="size-3 bg-[var(--ember)]" />
                    {dict.ui.near}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="size-3 bg-[var(--panel-ink)]/25" />
                    {dict.ui.miss}
                  </span>
                </div>
                ) : <div />}
                <button
                  className="min-h-12 w-full border border-[var(--panel-ink)] bg-[var(--panel-ink)] px-5 py-3 font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--panel)] transition-colors hover:bg-[var(--rust)] disabled:opacity-40 sm:w-auto"
                  disabled={!modeDay.solved}
                  onClick={handleShare}
                  type="button"
                >
                  {dict.ui.share}
                </button>
              </div>
            </ParchmentPanel>
          </section>

          <aside className="order-2 col-span-12 min-w-0 space-y-4 md:col-span-6 2xl:order-none 2xl:col-span-1 2xl:col-start-1 2xl:row-start-1">
            <Panel title={dict.ui.convict}>
              <div className="flex items-center gap-4">
                <div className="grid size-14 place-items-center border border-[var(--rust)]/60 bg-black/40 text-2xl text-[var(--ember-bright)]">
                  ※
                </div>
                <div>
                  <div className="text-xl leading-tight">
                    {authSession?.nick ?? dict.ui.nameless}
                  </div>
                  <div className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-[var(--bone-dim)]">
                    {playerCamp
                      ? `${playerCampLabel(persisted.lang, playerCamp)} · ${rankLabel(persisted.lang, playerCamp)}`
                      : "—"}
                  </div>
                </div>
              </div>
              <Stat
                label={dict.ui.totalXp}
                value={String(persisted.totalXp ?? 0)}
                bar={Math.min((persisted.totalXp ?? 0) / 5000, 1)}
              />
              <Stat
                label={dict.ui.streakDays}
                value={String(quoteStats.streak)}
                bar={Math.min(quoteStats.streak / 14, 1)}
              />
              <Stat
                label={dict.ui.effectiveness}
                value={`${Math.round(effectiveness(quoteStats) * 100)}%`}
                bar={effectiveness(quoteStats)}
              />
              <Stat
                label={dict.ui.avgAttempts}
                value={averageAttempts(quoteStats).toFixed(1).replace(".", ",")}
                bar={Math.min(averageAttempts(quoteStats) / 6, 1)}
              />
            </Panel>

            <Panel title={dict.ui.friendsLeague} subtitle={weekLabel.toUpperCase()}>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--bone-dim)]">
                {dict.ui.f2FriendsLeague}
              </p>
            </Panel>
          </aside>

          <aside className="order-3 col-span-12 min-w-0 space-y-4 md:col-span-6 2xl:order-none 2xl:col-span-1 2xl:col-start-3 2xl:row-start-1">
            <Panel title={dict.ui.campWar} subtitle={`${weekLabel.toUpperCase()} / ${dict.ui.day} ${(puzzle % 7) + 1}`}>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--bone-dim)]">
                {dict.ui.f2CampWar}
              </p>
            </Panel>

            <Panel
              title={dict.ui.pledge}
              subtitle={playerCamp ? undefined : dict.ui.chooseCamp}
            >
              {playerCamp ? (
                <CampSigil camp={playerCamp} />
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {PLAYER_CAMPS.map((camp) => (
                    <button
                      className="text-left"
                      key={camp}
                      onClick={() => handleCampSelect(camp)}
                      type="button"
                    >
                      <CampSigil camp={camp} />
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-3 font-mono text-[10pt] uppercase leading-relaxed tracking-[0.12em] text-[var(--bone-dim)]">
                {playerCamp ? dict.ui.campWarNote : dict.ui.campLockedNote}
              </p>
              <a
                className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 border border-[var(--ember)]/45 bg-[var(--ember)]/10 px-4 py-3 font-mono text-[10pt] uppercase tracking-[0.14em] text-[var(--ember-bright)] transition-colors hover:border-[var(--ember)] hover:bg-[var(--ember)]/20"
                href={FACEBOOK_GROUP_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                {dict.ui.joinCamp}
                <span aria-hidden="true">→</span>
              </a>
            </Panel>
          </aside>
        </div>
      </main>

      <footer className="relative z-10 mt-auto space-y-3 border-t border-[var(--hairline)] bg-black/50 px-6 py-5 font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--bone-dim)] lg:px-10">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <span>{dict.ui.footerRights}</span>
          <span>{dict.ui.footerReset}</span>
        </div>
        <p className="text-[10pt] leading-relaxed tracking-[0.12em] text-[var(--bone)]/70">
          {dict.ui.footerCanon}
        </p>
        <p className="max-w-3xl text-[10pt] normal-case leading-relaxed tracking-normal text-[var(--bone-dim)]/80">
          {dict.ui.footerLegal}
        </p>
        <p className="text-[10pt] tracking-[0.12em]">
          {dict.ui.footerContact}{" "}
          <a
            className="normal-case text-[var(--ember)]/90 transition-colors hover:text-[var(--ember-bright)]"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </footer>

      {!playerCamp ? (
        <CampOnboarding dict={dict} lang={persisted.lang} onSelect={handleCampSelect} />
      ) : null}
      {showHelp ? <HelpModal lang={persisted.lang} onClose={closeHelp} /> : null}
      {showSettings ? (
        <SettingsModal
          camp={playerCamp}
          lang={persisted.lang}
          onClose={() => setShowSettings(false)}
          onGoogleLogin={handleGoogleLogin}
          onLanguageChange={handleLanguageChange}
          onLogout={handleLogout}
          session={authSession}
        />
      ) : null}
      {resultContext ? (
        <ResultModal
          attempts={resultContext.attempts}
          distanceMeters={resultContext.distanceMeters}
          isLoggedIn={Boolean(authSession)}
          lang={persisted.lang}
          mode={resultContext.mode}
          onClose={() => setResultContext(null)}
          onPlayWithoutAccount={() => setResultContext(null)}
          onSaveProgress={handleGoogleLogin}
          onShare={handleShare}
          resetLabel={formatCountdown(resetMs)}
          stats={resultContext.stats}
          statsLoading={resultContext.statsLoading}
          streak={resultContext.streak}
          targetNpc={resultContext.npc}
          xpEarned={resultContext.xpEarned}
        />
      ) : null}
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border border-[var(--ember)]/40 bg-black/80 px-4 py-2 font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--bone)]">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

type FeedbackColumnKey = (typeof FEEDBACK_COLUMN_KEYS)[number];

function feedbackDebugTitle(key: FeedbackColumnKey, guess: Npc, target: Npc, lang: Locale) {
  const label = getDictionary(lang).ui.columns[key];
  const [guessValue, targetValue] = feedbackDebugValues(key, guess, target, lang);
  return `${label}
Wpisane: ${guessValue}
Poprawne: ${targetValue}`;
}

function feedbackDebugValues(key: FeedbackColumnKey, guess: Npc, target: Npc, lang: Locale): [string, string] {
  switch (key) {
    case "guild":
      return [`${guildLabel(lang, guess.guild)} (${guess.guild})`, `${guildLabel(lang, target.guild)} (${target.guild})`];
    case "guildFamily":
      return [
        `${campLabel(lang, guess.guildFamily)} (${guess.guildFamily})`,
        `${campLabel(lang, target.guildFamily)} (${target.guildFamily})`,
      ];
    case "location":
      return [
        `${npcLocationLabel(lang, guess)} (${guess.location}, obszar: ${guess.locationArea})`,
        `${npcLocationLabel(lang, target)} (${target.location}, obszar: ${target.locationArea})`,
      ];
    case "isTeacher":
      return [booleanLabel(guess.isTeacher, lang), booleanLabel(target.isTeacher, lang)];
    case "isFriend":
      return [booleanLabel(guess.isFriend, lang), booleanLabel(target.isFriend, lang)];
  }
}

function booleanLabel(value: boolean, lang: Locale) {
  if (lang === "en") return value ? "yes" : "no";
  if (lang === "de") return value ? "ja" : "nein";
  return value ? "tak" : "nie";
}

function Background() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,140,60,0.16),transparent_32%),radial-gradient(circle_at_78%_0%,rgba(85,125,59,0.12),transparent_28%),linear-gradient(180deg,rgba(8,6,4,0.38),rgba(8,6,4,0.94)),repeating-linear-gradient(90deg,rgba(255,255,255,0.03)_0_1px,transparent_1px_5rem),repeating-linear-gradient(0deg,rgba(255,255,255,0.025)_0_1px,transparent_1px_5rem)]" />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.16] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.7'/></svg>\")",
        }}
      />
    </>
  );
}

function Header({
  dict,
  lang,
  puzzle,
  resetLabel,
  onLanguageChange,
  onOpenHelp,
  onOpenSettings,
}: {
  dict: ReturnType<typeof getDictionary>;
  lang: Locale;
  puzzle: number;
  resetLabel: string;
  onLanguageChange: (lang: Locale) => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <header className="relative z-20 border-b border-[var(--hairline)] bg-black/40 backdrop-blur-sm">
      <div className="flex h-auto min-h-14 flex-wrap items-center justify-between gap-2 px-3 py-2 sm:h-14 sm:flex-nowrap sm:gap-0 sm:px-4 md:px-6 lg:px-10">
        <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
          <span
            className="text-xl tracking-[0.3em] text-[var(--ember-bright)]"
            style={{ textShadow: "0 0 18px rgba(255,140,60,0.45)" }}
          >
            {dict.ui.brand}
          </span>
          <span className="hidden font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--bone-dim)] sm:inline">
            {dict.ui.version}
          </span>
        </div>
        <div className="hidden items-center gap-4 font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--bone-dim)] md:flex lg:gap-6">
          <span className="hidden lg:inline">
            {dict.ui.day} <span className="text-[var(--bone)]">{puzzle}</span>
          </span>
          <span className="hidden lg:inline">
            {dict.ui.resetIn} <span className="text-[var(--ember-bright)]">{resetLabel}</span>
          </span>
          <LanguageSwitcher active={lang} ariaLabel={dict.ui.ariaLanguage} onChange={onLanguageChange} />
          <button
            aria-label={dict.ui.ariaHelp}
            className="min-h-11 min-w-11 text-[var(--bone-dim)] hover:text-[var(--bone)]"
            onClick={onOpenHelp}
            type="button"
          >
            {dict.ui.helpBtn}
          </button>
          <button
            aria-label={dict.ui.ariaSettings}
            className="min-h-11 min-w-11 text-[var(--bone-dim)] hover:text-[var(--bone)]"
            onClick={onOpenSettings}
            type="button"
          >
            {dict.ui.settingsBtn}
          </button>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10pt] uppercase tracking-[0.12em] md:hidden">
          <LanguageSwitcher active={lang} ariaLabel={dict.ui.ariaLanguage} onChange={onLanguageChange} />
          <button
            aria-label={dict.ui.ariaHelp}
            className="grid min-h-11 min-w-11 place-items-center text-[var(--bone-dim)]"
            onClick={onOpenHelp}
            type="button"
          >
            <span aria-hidden="true">?</span>
          </button>
          <button
            aria-label={dict.ui.ariaSettings}
            className="grid min-h-11 min-w-11 place-items-center text-[var(--bone-dim)]"
            onClick={onOpenSettings}
            type="button"
          >
            <span aria-hidden="true">⚙</span>
          </button>
          <div className="leading-tight">
            <div className="text-[var(--bone-dim)]">{dict.ui.resetShort}</div>
            <div className="text-[var(--ember-bright)]">{resetLabel}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function LanguageSwitcher({
  active,
  ariaLabel,
  onChange,
}: {
  active: Locale;
  ariaLabel: string;
  onChange: (lang: Locale) => void;
}) {
  const locales: Locale[] = ["pl", "en", "de"];
  return (
    <div
      className="flex items-center gap-1 rounded-sm border border-[var(--hairline)] bg-black/35 p-0.5"
      aria-label={ariaLabel}
      role="group"
    >
      {locales.map((locale) => (
        <button
          className={`min-h-9 min-w-9 px-2 text-[10pt] font-mono uppercase tracking-widest transition-colors ${
            active === locale
              ? "bg-[var(--ember)]/20 text-[var(--ember-bright)] ring-1 ring-[var(--ember)]/50"
              : "text-[var(--bone-dim)] hover:bg-[var(--bone)]/5 hover:text-[var(--bone)]"
          }`}
          key={locale}
          onClick={() => onChange(locale)}
          type="button"
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function QuoteDialogue({
  quote,
  lang,
  dict,
}: {
  quote: Quote;
  lang: Locale;
  dict: ReturnType<typeof getDictionary>;
}) {
  return (
    <div className="relative mb-8 space-y-3">
      <div className="absolute -left-3 bottom-0 top-0 w-px bg-[var(--rust)]/40" />
      {quote.lines.map((line, index) => (
        <Line
          key={`${line.speaker}-${index}`}
          text={line.text[lang]}
          who={line.speaker === "hero" ? dict.ui.hero : dict.ui.npc}
        />
      ))}
    </div>
  );
}

function CharacterCard({ npc, lang, revealed }: { npc: Npc; lang: Locale; revealed: boolean }) {
  const dict = getDictionary(lang);
  const card = dict.ui.card;
  const attributeValues = [
    { value: npc.attributes.ATR_STRENGTH ?? 0, top: 27.4 },
    { value: npc.attributes.ATR_DEXTERITY ?? 0, top: 34.4 },
    { value: npc.attributes.ATR_MANA_MAX ?? npc.attributes.ATR_MANA ?? 0, top: 41.3 },
    { value: npc.attributes.ATR_HITPOINTS_MAX ?? npc.attributes.ATR_HITPOINTS ?? 0, top: 48.4 },
  ];
  const talents = npc.talents.filter((talent) => talent.skill > 0);
  const portraitUrl = revealed && npc.originalId ? `/portraits/gothic1/${npc.originalId}.jpg` : null;
  const displayName = stripDiacritics(npcDisplayName(npc, lang));

  return (
    <div className="mb-6 flex justify-center">
      <article
        className="relative aspect-[710/1024] w-full max-w-[460px] overflow-hidden bg-black text-[#d6c19c] shadow-2xl"
        aria-label={dict.ui.cardOfDay}
        style={{
          backgroundImage: "url('/cards/gothic-card-template.png')",
          backgroundSize: "100% 100%",
        }}
      >
        {revealed ? (
          <div className="absolute left-[12%] right-[12%] text-center">
            <div
              className="truncate text-[3.25rem] tracking-wide text-[#d8c7ab] sm:text-[4rem]"
              style={{ fontFamily: "GothicCard, var(--font-serif)" }}
            >
              {displayName.toUpperCase()}
            </div>
          </div>
        ) : null}

        <div className="portrait-mask absolute left-[4%] top-[17.1%] h-[60%] w-[44.7%] bg-black/45">
          {portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="opacity-90 sepia-[0.25]" src={portraitUrl} />
          ) : null}
        </div>

        {attributeValues.map((attribute, index) => (
          <span
            className="absolute right-[4.1%] w-[16%] -translate-y-1/2 text-center font-serif text-2xl leading-none text-[#d9c7a9]"
            key={index}
            style={{ top: `${attribute.top}%` }}
          >
            {attribute.value}
          </span>
        ))}

        <span className="absolute left-[63.5%] top-[65%] w-[18%] -translate-y-1/2 text-center font-serif text-4xl text-[#d9c7a9]">
          {npc.level}
        </span>

        <div className="absolute bottom-[7.1%] left-[9.8%] h-[10%] w-[35%] px-3 text-[#251b13]">
          <ul className="space-y-1 font-serif text-sm">
            {talents.length > 0 ? (
              talents.slice(0, 4).map((talent) => (
                <li className="flex justify-between gap-3" key={talent.id}>
                  <span className="truncate">{talentLabel(card, talent.id)}</span>
                  <span>{talent.skill}</span>
                </li>
              ))
            ) : (
              <li>{card.empty}</li>
            )}
          </ul>
        </div>

        {revealed ? (
          <p className="absolute bottom-[10.5%] right-[10%] w-[33%] text-center font-serif text-base text-[#251b13]">
            {npcLocationLabel(lang, npc)}
          </p>
        ) : null}
      </article>
    </div>
  );
}

function talentLabel(card: ReturnType<typeof getDictionary>["ui"]["card"], talentId: string) {
  switch (talentId) {
    case "NPC_TALENT_1H":
      return card.talent1h;
    case "NPC_TALENT_2H":
      return card.talent2h;
    case "NPC_TALENT_BOW":
      return card.talentBow;
    case "NPC_TALENT_CROSSBOW":
      return card.talentCrossbow;
    case "NPC_TALENT_MAGE":
      return card.talentMage;
    case "NPC_TALENT_SNEAK":
      return card.talentSneak;
    case "NPC_TALENT_PICKLOCK":
      return card.talentPicklock;
    case "NPC_TALENT_PICKPOCKET":
      return card.talentPickpocket;
    case "NPC_TALENT_ACROBAT":
      return card.talentAcrobat;
    default:
      return talentId.replace(/^NPC_TALENT_/, "");
  }
}

function stripDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ł/g, "L")
    .replace(/ł/g, "l");
}

function CampSigil({ camp }: { camp: PlayerCamp }) {
  const theme = CAMP_THEMES[camp];

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[150px] overflow-hidden border border-[var(--hairline)] bg-black/30"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        className="size-full object-contain p-2 opacity-80"
        src={theme.imageUrl}
      />
      <span className="absolute inset-3 border border-[var(--bone)]/25" />
    </div>
  );
}

function CampOnboarding({
  dict,
  lang,
  onSelect,
}: {
  dict: ReturnType<typeof getDictionary>;
  lang: Locale;
  onSelect: (camp: PlayerCamp) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-black/70 px-4 py-6 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-[var(--hairline)] bg-black/90 p-5 sm:p-6">
        <h2 className="text-2xl text-[var(--ember-bright)]">{dict.ui.onboardingTitle}</h2>
        <p className="mt-3 font-mono text-[10pt] uppercase leading-relaxed tracking-[0.12em] text-[var(--bone-dim)]">
          {dict.ui.onboardingBody}
        </p>
        <p className="mt-3 font-mono text-[10pt] uppercase leading-relaxed tracking-[0.12em] text-[var(--ember-bright)]">
          {dict.ui.campLockedNote}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {PLAYER_CAMPS.map((camp) => (
            <button
              className="space-y-2 text-center"
              key={camp}
              onClick={() => onSelect(camp)}
              type="button"
            >
              <CampSigil camp={camp} />
              <span className="block font-mono text-[10pt] uppercase tracking-[0.12em] text-[var(--bone)]">
                {playerCampLabel(lang, camp)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
