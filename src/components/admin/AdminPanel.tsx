"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Locale, ModeId, Npc, Quote } from "@/src/core/types";
import { loadAuth, startGoogleLogin } from "@/src/core/auth";
import { LAUNCH_DAY, puzzleNumber } from "@/src/core/daily";
import { npcDisplayName } from "@/src/data";

type Tab = "schedule" | "quotes" | "npcs" | "map" | "cards";
type AdminNpc = Npc & { enabled: boolean };
type AdminQuote = Quote & { enabled: boolean; qualityStatus?: string; adminNote?: string | null };

const TAB_LABELS: Record<Tab, string> = {
  schedule: "Harmonogram",
  npcs: "Klasyczny",
  quotes: "Cytat",
  map: "Mapa",
  cards: "Karta",
};

const MODE_LABELS: Record<ModeId, string> = {
  classic: "Klasyczny",
  quote: "Cytat",
  map: "Mapa",
  card: "Karta",
};

interface AdminSnapshot {
  dailyPuzzles: Array<{
    puzzle: number;
    mode: string;
    npcId?: string | null;
    quoteId?: string | null;
    mapPuzzleId?: number | null;
    published: number;
  }>;
  maps: Array<{
    id: string;
    name: string;
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
    metersPerPixel: number;
    defaultToleranceMeters: number;
  }>;
  mapPuzzles: Array<{
    id: number;
    mapId: string;
    npcId: string;
    npcName?: string;
    x: number;
    y: number;
    toleranceMeters?: number | null;
    chapterPl?: string | null;
    chapterEn?: string | null;
    chapterDe?: string | null;
  }>;
}

export default function AdminPanel() {
  const [session, setSession] = useState<ReturnType<typeof loadAuth>>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("schedule");
  const [puzzle, setPuzzle] = useState(puzzleNumber());
  const [selectedNpcDay, setSelectedNpcDay] = useState(puzzleNumber());
  const [selectedQuoteDay, setSelectedQuoteDay] = useState(puzzleNumber());
  const [selectedMapDay, setSelectedMapDay] = useState(puzzleNumber());
  const [selectedCardDay, setSelectedCardDay] = useState(puzzleNumber());
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [npcs, setNpcs] = useState<AdminNpc[]>([]);
  const [quotes, setQuotes] = useState<AdminQuote[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [mapNpcId, setMapNpcId] = useState("");
  const [mapPoint, setMapPoint] = useState<{ x: number; y: number } | null>(null);
  const [chapterPl, setChapterPl] = useState("");
  const [chapterEn, setChapterEn] = useState("");
  const [chapterDe, setChapterDe] = useState("");

  const headers = useMemo(() => {
    if (!session) return null;
    return { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" };
  }, [session]);

  const refresh = useCallback(async () => {
    if (!sessionChecked) return;
    if (!headers) {
      setAuthorized(false);
      return;
    }
    const [meRes, snapRes] = await Promise.all([
      fetch("/api/admin/me", { headers }),
      fetch("/api/admin/snapshot", { headers }),
    ]);
    if (!meRes.ok) {
      setAuthorized(false);
      return;
    }
    setAuthorized(true);
    if (snapRes.ok) setSnapshot((await snapRes.json()) as AdminSnapshot);
  }, [headers, sessionChecked]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setSession(loadAuth());
      setSessionChecked(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      await refresh();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!headers || !authorized || (tab !== "npcs" && tab !== "quotes" && tab !== "cards")) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        if (tab === "npcs" || tab === "cards") {
          const npcRes = await fetch(`/api/admin/npcs?q=${encodeURIComponent(search)}`, { headers });
          if (npcRes.ok && !cancelled) {
            const data = (await npcRes.json()) as { npcs: AdminNpc[] };
            setNpcs(data.npcs);
          }
        }

        if (tab === "quotes") {
          const quoteRes = await fetch(`/api/admin/quotes?q=${encodeURIComponent(search)}`, { headers });
          if (quoteRes.ok && !cancelled) {
            const data = (await quoteRes.json()) as { quotes: AdminQuote[] };
            setQuotes(data.quotes);
          }
        }
      })();
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [authorized, headers, search, tab]);

  useEffect(() => {
    if (!headers || !authorized || tab !== "map") return;
    void (async () => {
      const npcRes = await fetch(`/api/admin/npcs?q=${encodeURIComponent(search)}`, { headers });
      if (npcRes.ok) {
        const data = (await npcRes.json()) as { npcs: AdminNpc[] };
        setNpcs(data.npcs);
      }
    })();
  }, [authorized, headers, search, tab]);

  const scheduleForDay = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.dailyPuzzles.filter((row) => row.puzzle === puzzle);
  }, [snapshot, puzzle]);

  const activeMap = snapshot?.maps[0];

  const npcById = useMemo(() => new Map(npcs.map((npc) => [npc.id, npc])), [npcs]);
  const quoteById = useMemo(() => new Map(quotes.map((quote) => [quote.id, quote])), [quotes]);

  const assignedClassicNpcIds = useMemo(() => {
    if (!snapshot) return new Set<string>();
    return new Set(
      snapshot.dailyPuzzles
        .filter((row) => row.mode === "classic" && row.npcId)
        .map((row) => row.npcId as string),
    );
  }, [snapshot]);

  const assignedCardNpcIds = useMemo(() => {
    if (!snapshot) return new Set<string>();
    return new Set(
      snapshot.dailyPuzzles
        .filter((row) => row.mode === "card" && row.npcId)
        .map((row) => row.npcId as string),
    );
  }, [snapshot]);

  const assignedQuoteIds = useMemo(() => {
    if (!snapshot) return new Set<string>();
    return new Set(
      snapshot.dailyPuzzles
        .filter((row) => row.mode === "quote" && row.quoteId)
        .map((row) => row.quoteId as string),
    );
  }, [snapshot]);

  const availableQuotes = useMemo(
    () => quotes.filter((quote) => quote.enabled && !assignedQuoteIds.has(quote.id)),
    [assignedQuoteIds, quotes],
  );

  const availableClassicNpcs = useMemo(
    () => npcs.filter((npc) => npc.enabled && !assignedClassicNpcIds.has(npc.id)),
    [assignedClassicNpcIds, npcs],
  );

  const availableCardNpcs = useMemo(
    () => npcs.filter((npc) => npc.enabled && !assignedCardNpcIds.has(npc.id)),
    [assignedCardNpcIds, npcs],
  );

  const mapPuzzleByNpcId = useMemo(
    () => new Map((snapshot?.mapPuzzles ?? []).map((entry) => [entry.npcId, entry])),
    [snapshot],
  );

  const mapPuzzleById = useMemo(
    () => new Map((snapshot?.mapPuzzles ?? []).map((entry) => [entry.id, entry])),
    [snapshot],
  );

  const scheduledMapPuzzleIds = useMemo(() => {
    if (!snapshot) return new Set<number>();
    return new Set(
      snapshot.dailyPuzzles
        .filter((row) => row.mode === "map" && row.mapPuzzleId)
        .map((row) => row.mapPuzzleId as number),
    );
  }, [snapshot]);

  const quoteDays = useMemo(() => {
    const scheduledMax = Math.max(0, ...(snapshot?.dailyPuzzles.map((row) => row.puzzle) ?? []));
    const maxDay = Math.max(13, puzzle + 13, scheduledMax);
    return Array.from({ length: maxDay + 1 }, (_, day) => day);
  }, [puzzle, snapshot]);

  function setActivePuzzle(value: number) {
    const safeValue = Math.max(0, value);
    setPuzzle(safeValue);
    setSelectedNpcDay(safeValue);
    setSelectedQuoteDay(safeValue);
    setSelectedMapDay(safeValue);
    setSelectedCardDay(safeValue);
  }

  function dateForPuzzle(day: number) {
    const date = new Date(`${LAUNCH_DAY}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + day);
    return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  }

  function quoteLinePreview(quote: Quote) {
    return quote.lines
      .slice(0, 4)
      .map((line) => `${line.speaker === "hero" ? "Bohater" : "NPC"}: ${line.text.pl}`)
      .join("\n");
  }

  async function saveScheduleForPuzzle(targetPuzzle: number, mode: ModeId, payload: Record<string, unknown>) {
    if (!headers) return;
    const response = await fetch("/api/admin/schedule", {
      method: "PUT",
      headers,
      body: JSON.stringify({ puzzle: targetPuzzle, mode, ...payload }),
    });
    setMessage(response.ok ? "Zapisano harmonogram." : "Błąd zapisu harmonogramu.");
    await refresh();
  }

  async function assignQuoteToDay(targetPuzzle: number, quote: Quote) {
    setSelectedQuoteDay(targetPuzzle);
    setPuzzle(targetPuzzle);
    await saveScheduleForPuzzle(targetPuzzle, "quote", { quoteId: quote.id, npcId: quote.npcId });
  }

  async function assignNpcToDay(targetPuzzle: number, npc: Npc) {
    setSelectedNpcDay(targetPuzzle);
    setPuzzle(targetPuzzle);
    await saveScheduleForPuzzle(targetPuzzle, "classic", { npcId: npc.id });
  }

  async function assignCardNpcToDay(targetPuzzle: number, npc: Npc) {
    setSelectedCardDay(targetPuzzle);
    setPuzzle(targetPuzzle);
    await saveScheduleForPuzzle(targetPuzzle, "card", { npcId: npc.id });
  }

  function loadMapEditorForDay(day: number) {
    setSelectedMapDay(day);
    setPuzzle(day);
    const row = snapshot?.dailyPuzzles.find((entry) => entry.puzzle === day && entry.mode === "map");
    if (!row?.npcId) return;
    setMapNpcId(row.npcId);
    const point = row.mapPuzzleId
      ? mapPuzzleById.get(row.mapPuzzleId)
      : mapPuzzleByNpcId.get(row.npcId);
    if (point) {
      setMapPoint({ x: point.x, y: point.y });
      setChapterPl(point.chapterPl ?? "");
      setChapterEn(point.chapterEn ?? "");
      setChapterDe(point.chapterDe ?? "");
    } else {
      setMapPoint(null);
      setChapterPl("");
      setChapterEn("");
      setChapterDe("");
    }
  }

  function resolveMapNpcIdForClick(): string | null {
    if (mapNpcId) return mapNpcId;
    const row = snapshot?.dailyPuzzles.find(
      (entry) => entry.puzzle === selectedMapDay && entry.mode === "map",
    );
    if (row?.npcId) {
      setMapNpcId(row.npcId);
      return row.npcId;
    }
    return null;
  }

  async function assignMapNpcToDay(targetPuzzle: number, npc: Npc) {
    setSelectedMapDay(targetPuzzle);
    setPuzzle(targetPuzzle);
    setMapNpcId(npc.id);
    const existingPoint = mapPuzzleByNpcId.get(npc.id);
    if (!existingPoint) {
      setMapPoint(null);
      setChapterPl("");
      setChapterEn("");
      setChapterDe("");
      setMessage("Najpierw ustaw punkt tej osoby na mapie, potem zapisz dzień.");
      return;
    }
    setMapPoint({ x: existingPoint.x, y: existingPoint.y });
    setChapterPl(existingPoint.chapterPl ?? "");
    setChapterEn(existingPoint.chapterEn ?? "");
    setChapterDe(existingPoint.chapterDe ?? "");
    await saveScheduleForPuzzle(targetPuzzle, "map", { npcId: npc.id, mapPuzzleId: existingPoint.id });
  }

  async function toggleNpc(id: string, enabled: boolean) {
    if (!headers) return;
    await fetch("/api/admin/npcs", { method: "PATCH", headers, body: JSON.stringify({ id, enabled }) });
    setMessage(`NPC ${enabled ? "włączony" : "wyłączony"}.`);
    setSearch((value) => value);
  }

  async function toggleQuote(id: string, enabled: boolean) {
    if (!headers) return;
    await fetch("/api/admin/quotes", { method: "PATCH", headers, body: JSON.stringify({ id, enabled }) });
    setMessage(`Cytat ${enabled ? "włączony" : "wyłączony"}.`);
    setSearch((value) => value);
  }

  async function saveMapPuzzle() {
    if (!headers || !activeMap || !mapNpcId || !mapPoint) return;
    const existingPoint = mapPuzzleByNpcId.get(mapNpcId);
    const response = await fetch("/api/admin/map-puzzles", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        id: existingPoint?.id,
        mapId: activeMap.id,
        npcId: mapNpcId,
        x: mapPoint.x,
        y: mapPoint.y,
        toleranceMeters: activeMap.defaultToleranceMeters,
        chapterPl: chapterPl || null,
        chapterEn: chapterEn || null,
        chapterDe: chapterDe || null,
      }),
    });
    if (!response.ok) {
      setMessage("Błąd zapisu punktu mapy.");
      return;
    }
    const data = (await response.json()) as { id: number };
    await saveScheduleForPuzzle(selectedMapDay, "map", { npcId: mapNpcId, mapPuzzleId: data.id });
    setMessage("Zapisano punkt mapy i harmonogram.");
    await refresh();
  }

  if (!sessionChecked || authorized === null) {
    return <div className="min-h-screen bg-black p-8 text-[var(--bone)]">Ładowanie panelu…</div>;
  }

  if (!headers) {
    return (
      <div className="min-h-screen bg-black p-8 text-[var(--bone)]">
        <h1 className="mb-4 text-3xl">KOLONIA Admin</h1>
        <p className="mb-6 text-[var(--bone-dim)]">Zaloguj się kontem Google, aby zarządzać treścią.</p>
        <button
          className="border border-[var(--ember)] px-4 py-2"
          onClick={() => startGoogleLogin()}
          type="button"
        >
          Zaloguj przez Google
        </button>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-black p-8 text-[var(--bone)]">
        <h1 className="mb-4 text-3xl">Brak uprawnień</h1>
        <p className="text-[var(--bone-dim)]">
          To konto nie ma roli admin. Ustaw `ADMIN_GOOGLE_SUBS` lub `role=admin` w bazie.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0b09] p-4 text-[var(--bone)] sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl text-[var(--ember-bright)]">KOLONIA Admin</h1>
            <p className="text-sm text-[var(--bone-dim)]">Harmonogram, cytaty, NPC i mapa</p>
          </div>
          <Link className="text-sm text-[var(--ember)]" href="/">
            ← Gra
          </Link>
        </div>

        {message ? <p className="mb-4 border border-[var(--ember)]/40 p-3 text-sm">{message}</p> : null}

        <div className="mb-6 flex flex-wrap gap-2">
          {(["schedule", "npcs", "quotes", "map", "cards"] as Tab[]).map((item) => (
            <button
              className={`border px-3 py-2 text-xs uppercase tracking-widest ${
                tab === item ? "border-[var(--ember)] text-[var(--ember-bright)]" : "border-[var(--hairline)]"
              }`}
              key={item}
              onClick={() => setTab(item)}
              type="button"
            >
              {TAB_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="mb-6 flex items-center gap-3">
          <label className="text-xs uppercase tracking-widest text-[var(--bone-dim)]">Dzień</label>
          <input
            className="w-24 border border-[var(--hairline)] bg-black px-3 py-2"
            min={0}
            onChange={(event) => setActivePuzzle(Number(event.target.value))}
            type="number"
            value={puzzle}
          />
        </div>

        {tab === "schedule" ? (
          <section className="space-y-4">
            <h2 className="text-xl">Harmonogram dnia {puzzle}</h2>
            {(["classic", "quote", "map", "card"] as ModeId[]).map((mode) => {
              const row = scheduleForDay.find((entry) => entry.mode === mode);
              return (
                <div className="border border-[var(--hairline)] p-4" key={mode}>
                  <div className="mb-2 font-mono text-xs uppercase tracking-widest text-[var(--ember)]">
                    {MODE_LABELS[mode]}
                  </div>
                  <pre className="overflow-x-auto text-xs text-[var(--bone-dim)]">
                    {JSON.stringify(row ?? { status: "brak" }, null, 2)}
                  </pre>
                </div>
              );
            })}
            <p className="text-sm text-[var(--bone-dim)]">
              Użyj zakładek Klasyczny, Cytat, Mapa i Karta, aby przypisać treść do wybranego dnia.
            </p>
          </section>
        ) : null}

        {tab === "npcs" ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(320px,0.95fr)_minmax(420px,1.25fr)]">
            <div className="space-y-3">
              <div>
                <h2 className="text-xl">NPC po dniach</h2>
                <p className="text-sm text-[var(--bone-dim)]">
                  Upuść osobę z prawej strony na wybrany dzień. Po przypisaniu znika z listy dostępnych.
                </p>
              </div>
              <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-2">
                {quoteDays.map((day) => {
                  const row = snapshot?.dailyPuzzles.find((entry) => entry.puzzle === day && entry.mode === "classic");
                  const assignedNpc = row?.npcId ? npcById.get(row.npcId) : undefined;
                  return (
                    <article
                      className={`border p-3 transition-colors ${
                        selectedNpcDay === day
                          ? "border-[var(--ember)]"
                          : dragOverDay === day
                            ? "border-[var(--ember-bright)] bg-[var(--ember)]/10"
                            : "border-[var(--hairline)]"
                      }`}
                      key={day}
                      onClick={() => {
                        setSelectedNpcDay(day);
                        setPuzzle(day);
                      }}
                      onDragLeave={() => setDragOverDay(null)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDragOverDay(day);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const npcId = event.dataTransfer.getData("text/plain");
                        const npc = npcById.get(npcId);
                        setDragOverDay(null);
                        if (npc) void assignNpcToDay(day, npc);
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm uppercase tracking-widest text-[var(--ember)]">Dzień {day}</div>
                          <div className="text-xs text-[var(--bone-dim)]">{dateForPuzzle(day)}</div>
                        </div>
                        <span className="text-xs text-[var(--bone-dim)]">{row?.published === 0 ? "draft" : "live"}</span>
                      </div>
                      {assignedNpc ? (
                        <div>
                          <div className="font-serif text-lg">{npcDisplayName(assignedNpc, "pl" as Locale)}</div>
                          <div className="text-xs text-[var(--bone-dim)]">{assignedNpc.id}</div>
                        </div>
                      ) : row?.npcId ? (
                        <p className="text-sm text-[var(--bone-dim)]">Przypisany NPC: {row.npcId}</p>
                      ) : (
                        <p className="text-sm text-[var(--bone-dim)]">Brak NPC. Przeciągnij tutaj osobę z prawej.</p>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h2 className="text-xl">Dostępne osoby</h2>
                <p className="text-sm text-[var(--bone-dim)]">
                  Pokazuję osoby nieprzypisane do żadnego dnia w trybie klasycznym.
                </p>
              </div>
              <input
                className="w-full border border-[var(--hairline)] bg-black px-3 py-2"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Szukaj NPC…"
                value={search}
              />
              <ul className="max-h-[64vh] divide-y divide-[var(--hairline)] overflow-y-auto border border-[var(--hairline)]">
                {availableClassicNpcs.map((npc) => (
                  <li
                    className="flex cursor-grab flex-wrap items-center justify-between gap-3 p-3 active:cursor-grabbing"
                    draggable
                    key={npc.id}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", npc.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                  >
                    <div>
                      <div className="font-serif text-lg">{npcDisplayName(npc, "pl" as Locale)}</div>
                      <div className="text-xs text-[var(--bone-dim)]">{npc.id}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="border border-[var(--ember)] px-3 py-1 text-xs"
                        onClick={() => void assignNpcToDay(selectedNpcDay, npc)}
                        type="button"
                      >
                        Do dnia {selectedNpcDay}
                      </button>
                      <button
                        className="border border-[var(--hairline)] px-3 py-1 text-xs"
                        onClick={() => void toggleNpc(npc.id, !npc.enabled)}
                        type="button"
                      >
                        {npc.enabled ? "Wyłącz" : "Włącz"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {availableClassicNpcs.length === 0 ? (
                <p className="text-sm text-[var(--bone-dim)]">Brak dostępnych osób dla aktualnego wyszukiwania.</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {tab === "cards" ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(320px,0.95fr)_minmax(420px,1.25fr)]">
            <div className="space-y-3">
              <div>
                <h2 className="text-xl">Karty po dniach</h2>
                <p className="text-sm text-[var(--bone-dim)]">
                  Upuść osobę z prawej strony na wybrany dzień. To będzie dzienna karta postaci.
                </p>
              </div>
              <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-2">
                {quoteDays.map((day) => {
                  const row = snapshot?.dailyPuzzles.find((entry) => entry.puzzle === day && entry.mode === "card");
                  const assignedNpc = row?.npcId ? npcById.get(row.npcId) : undefined;
                  return (
                    <article
                      className={`border p-3 transition-colors ${
                        selectedCardDay === day
                          ? "border-[var(--ember)]"
                          : dragOverDay === day
                            ? "border-[var(--ember-bright)] bg-[var(--ember)]/10"
                            : "border-[var(--hairline)]"
                      }`}
                      key={day}
                      onClick={() => {
                        setSelectedCardDay(day);
                        setPuzzle(day);
                      }}
                      onDragLeave={() => setDragOverDay(null)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDragOverDay(day);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const npcId = event.dataTransfer.getData("text/plain");
                        const npc = npcById.get(npcId);
                        setDragOverDay(null);
                        if (npc) void assignCardNpcToDay(day, npc);
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm uppercase tracking-widest text-[var(--ember)]">Dzień {day}</div>
                          <div className="text-xs text-[var(--bone-dim)]">{dateForPuzzle(day)}</div>
                        </div>
                        <span className="text-xs text-[var(--bone-dim)]">{row?.published === 0 ? "draft" : "live"}</span>
                      </div>
                      {assignedNpc ? (
                        <div>
                          <div className="font-serif text-lg">{npcDisplayName(assignedNpc, "pl" as Locale)}</div>
                          <div className="text-xs text-[var(--bone-dim)]">
                            {assignedNpc.id} · lvl {assignedNpc.level}
                          </div>
                        </div>
                      ) : row?.npcId ? (
                        <p className="text-sm text-[var(--bone-dim)]">Przypisany NPC: {row.npcId}</p>
                      ) : (
                        <p className="text-sm text-[var(--bone-dim)]">Brak karty. Przeciągnij tutaj osobę z prawej.</p>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h2 className="text-xl">Dostępne karty</h2>
                <p className="text-sm text-[var(--bone-dim)]">
                  Pokazuję osoby nieprzypisane do żadnego dnia w trybie Karta.
                </p>
              </div>
              <input
                className="w-full border border-[var(--hairline)] bg-black px-3 py-2"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Szukaj NPC…"
                value={search}
              />
              <ul className="max-h-[64vh] divide-y divide-[var(--hairline)] overflow-y-auto border border-[var(--hairline)]">
                {availableCardNpcs.map((npc) => (
                  <li
                    className="flex cursor-grab flex-wrap items-center justify-between gap-3 p-3 active:cursor-grabbing"
                    draggable
                    key={npc.id}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", npc.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                  >
                    <div>
                      <div className="font-serif text-lg">{npcDisplayName(npc, "pl" as Locale)}</div>
                      <div className="text-xs text-[var(--bone-dim)]">
                        {npc.id} · lvl {npc.level}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="border border-[var(--ember)] px-3 py-1 text-xs"
                        onClick={() => void assignCardNpcToDay(selectedCardDay, npc)}
                        type="button"
                      >
                        Do dnia {selectedCardDay}
                      </button>
                      <button
                        className="border border-[var(--hairline)] px-3 py-1 text-xs"
                        onClick={() => void toggleNpc(npc.id, !npc.enabled)}
                        type="button"
                      >
                        {npc.enabled ? "Wyłącz" : "Włącz"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {availableCardNpcs.length === 0 ? (
                <p className="text-sm text-[var(--bone-dim)]">Brak dostępnych kart dla aktualnego wyszukiwania.</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {tab === "quotes" ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(320px,0.95fr)_minmax(420px,1.25fr)]">
            <div className="space-y-3">
              <div>
                <h2 className="text-xl">Dialogi po dniach</h2>
                <p className="text-sm text-[var(--bone-dim)]">
                  Upuść dialog z prawej strony na wybrany dzień. Dzień 0 to {dateForPuzzle(0)}.
                </p>
              </div>
              <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-2">
                {quoteDays.map((day) => {
                  const row = snapshot?.dailyPuzzles.find((entry) => entry.puzzle === day && entry.mode === "quote");
                  const assignedQuote = row?.quoteId ? quoteById.get(row.quoteId) : undefined;
                  return (
                    <article
                      className={`border p-3 transition-colors ${
                        selectedQuoteDay === day
                          ? "border-[var(--ember)]"
                          : dragOverDay === day
                            ? "border-[var(--ember-bright)] bg-[var(--ember)]/10"
                            : "border-[var(--hairline)]"
                      }`}
                      key={day}
                      onClick={() => setActivePuzzle(day)}
                      onDragLeave={() => setDragOverDay(null)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDragOverDay(day);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const quoteId = event.dataTransfer.getData("text/plain");
                        const quote = quoteById.get(quoteId);
                        setDragOverDay(null);
                        if (quote) void assignQuoteToDay(day, quote);
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm uppercase tracking-widest text-[var(--ember)]">Dzień {day}</div>
                          <div className="text-xs text-[var(--bone-dim)]">{dateForPuzzle(day)}</div>
                        </div>
                        <span className="text-xs text-[var(--bone-dim)]">{row?.published === 0 ? "draft" : "live"}</span>
                      </div>
                      {assignedQuote ? (
                        <div className="space-y-2">
                          <div className="text-xs text-[var(--bone-dim)]">{assignedQuote.id}</div>
                          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                            {quoteLinePreview(assignedQuote)}
                          </pre>
                        </div>
                      ) : row?.quoteId ? (
                        <p className="text-sm text-[var(--bone-dim)]">Przypisany dialog: {row.quoteId}</p>
                      ) : (
                        <p className="text-sm text-[var(--bone-dim)]">Brak dialogu. Przeciągnij tutaj pozycję z prawej.</p>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h2 className="text-xl">Dostępne dialogi</h2>
                <p className="text-sm text-[var(--bone-dim)]">
                  Pokazuję tylko dialogi nieprzypisane do żadnego dnia. Po przypisaniu znikają z tej listy.
                </p>
              </div>
              <input
                className="w-full border border-[var(--hairline)] bg-black px-3 py-2"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Szukaj dialogu, NPC albo tekstu…"
                value={search}
              />
              <ul className="max-h-[64vh] divide-y divide-[var(--hairline)] overflow-y-auto border border-[var(--hairline)]">
                {availableQuotes.map((quote) => (
                  <li
                    className="cursor-grab space-y-3 p-3 active:cursor-grabbing"
                    draggable
                    key={quote.id}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", quote.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-[var(--bone-dim)]">{quote.id}</div>
                        <div className="text-sm text-[var(--ember)]">{quote.npcId}</div>
                      </div>
                      <button
                        className="border border-[var(--ember)] px-3 py-1 text-xs"
                        onClick={() => void assignQuoteToDay(selectedQuoteDay, quote)}
                        type="button"
                      >
                        Do dnia {selectedQuoteDay}
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {quoteLinePreview(quote)}
                      {quote.lines.length > 4 ? "\n…" : ""}
                    </pre>
                    <button
                      className="border border-[var(--hairline)] px-3 py-1 text-xs"
                      onClick={() => void toggleQuote(quote.id, !quote.enabled)}
                      type="button"
                    >
                      {quote.enabled ? "Wyłącz" : "Włącz"}
                    </button>
                  </li>
                ))}
              </ul>
              {availableQuotes.length === 0 ? (
                <p className="text-sm text-[var(--bone-dim)]">Brak dostępnych dialogów dla aktualnego wyszukiwania.</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {tab === "map" && activeMap ? (
          <section className="grid gap-6 xl:grid-cols-[300px_minmax(420px,1fr)_360px]">
            <div className="space-y-3">
              <div>
                <h2 className="text-xl">Mapa po dniach</h2>
                <p className="text-sm text-[var(--bone-dim)]">
                  Upuść osobę z prawej na dzień. Jeśli nie ma punktu, wybierz ją i kliknij mapę.
                </p>
              </div>
              <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-2">
                {quoteDays.map((day) => {
                  const row = snapshot?.dailyPuzzles.find((entry) => entry.puzzle === day && entry.mode === "map");
                  const point = row?.mapPuzzleId ? mapPuzzleById.get(row.mapPuzzleId) : undefined;
                  const npc = row?.npcId ? npcById.get(row.npcId) : undefined;
                  return (
                    <article
                      className={`border p-3 transition-colors ${
                        selectedMapDay === day
                          ? "border-[var(--ember)]"
                          : dragOverDay === day
                            ? "border-[var(--ember-bright)] bg-[var(--ember)]/10"
                            : "border-[var(--hairline)]"
                      }`}
                      key={day}
                      onClick={() => loadMapEditorForDay(day)}
                      onDragLeave={() => setDragOverDay(null)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDragOverDay(day);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const npcId = event.dataTransfer.getData("text/plain");
                        const droppedNpc = npcById.get(npcId);
                        setDragOverDay(null);
                        if (droppedNpc) void assignMapNpcToDay(day, droppedNpc);
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm uppercase tracking-widest text-[var(--ember)]">Dzień {day}</div>
                          <div className="text-xs text-[var(--bone-dim)]">{dateForPuzzle(day)}</div>
                        </div>
                        {point ? <span className="text-xs text-[var(--ember-bright)]">CHECKED</span> : null}
                      </div>
                      {npc ? (
                        <div>
                          <div className="font-serif text-lg">{npcDisplayName(npc, "pl" as Locale)}</div>
                          <div className="text-xs text-[var(--bone-dim)]">
                            {npc.id}
                            {point ? ` · x=${point.x.toFixed(3)} y=${point.y.toFixed(3)}` : ""}
                          </div>
                        </div>
                      ) : row?.npcId ? (
                        <p className="text-sm text-[var(--bone-dim)]">Przypisany NPC: {row.npcId}</p>
                      ) : (
                        <p className="text-sm text-[var(--bone-dim)]">Brak osoby. Przeciągnij tutaj NPC z prawej.</p>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h2 className="text-xl">Punkt na mapie — dzień {selectedMapDay}</h2>
                <p className="text-sm text-[var(--bone-dim)]">
                  Wybrana osoba:{" "}
                  {mapNpcId && npcById.get(mapNpcId)
                    ? npcDisplayName(npcById.get(mapNpcId)!, "pl" as Locale)
                    : "brak — wybierz osobę z listy po prawej"}
                  . Kliknij mapę, aby ustawić albo przesunąć punkt.
                </p>
              </div>
              <div className="relative w-full border border-[var(--hairline)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={activeMap.name}
                  className="block max-h-[72vh] w-full cursor-crosshair"
                  onClick={(event) => {
                    if (!resolveMapNpcIdForClick()) {
                      setMessage("Najpierw wybierz osobę z listy po prawej.");
                      return;
                    }
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMapPoint({
                      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
                      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
                    });
                  }}
                  src={activeMap.imageUrl}
                />
                {snapshot?.mapPuzzles.map((point) => (
                  <span
                    className={`pointer-events-none absolute z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-[0_0_8px_rgba(0,0,0,0.8)] ${
                      point.npcId === mapNpcId
                        ? "border-white bg-[var(--ember)]"
                        : "border-black/80 bg-[var(--bone)]"
                    }`}
                    key={point.id}
                    title={point.npcId}
                    style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                  />
                ))}
                {mapPoint ? (
                  <span
                    className="pointer-events-none absolute z-20 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--ember)] shadow-[0_0_14px_rgba(255,120,40,0.95)] ring-2 ring-[var(--ember-bright)]/60"
                    style={{ left: `${mapPoint.x * 100}%`, top: `${mapPoint.y * 100}%` }}
                  />
                ) : null}
                {!mapNpcId ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 p-4 text-center text-sm text-[var(--bone)]">
                    Wybierz osobę z listy po prawej, potem kliknij mapę
                  </div>
                ) : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  className="border border-[var(--hairline)] bg-black px-3 py-2"
                  onChange={(event) => setChapterPl(event.target.value)}
                  placeholder="Rozdział PL"
                  value={chapterPl}
                />
                <input
                  className="border border-[var(--hairline)] bg-black px-3 py-2"
                  onChange={(event) => setChapterEn(event.target.value)}
                  placeholder="Chapter EN"
                  value={chapterEn}
                />
                <input
                  className="border border-[var(--hairline)] bg-black px-3 py-2"
                  onChange={(event) => setChapterDe(event.target.value)}
                  placeholder="Kapitel DE"
                  value={chapterDe}
                />
              </div>
              {mapPoint ? (
                <p className="text-xs text-[var(--bone-dim)]">
                  Punkt: x={mapPoint.x.toFixed(3)}, y={mapPoint.y.toFixed(3)}
                </p>
              ) : null}
              <button
                className="w-full border border-[var(--ember)] px-4 py-3 text-sm uppercase tracking-widest"
                disabled={!mapNpcId || !mapPoint}
                onClick={() => void saveMapPuzzle()}
                type="button"
              >
                Zapisz punkt i przypisz do dnia {selectedMapDay}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <h2 className="text-xl">Osoby na mapę</h2>
                <p className="text-sm text-[var(--bone-dim)]">CHECKED = punkt istnieje i jest zaplanowany na jakiś dzień.</p>
              </div>
              <input
                className="w-full border border-[var(--hairline)] bg-black px-3 py-2"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Szukaj NPC…"
                value={search}
              />
              <ul className="max-h-[64vh] divide-y divide-[var(--hairline)] overflow-y-auto border border-[var(--hairline)]">
                {npcs.filter((npc) => npc.enabled).map((npc) => {
                  const point = mapPuzzleByNpcId.get(npc.id);
                  const checked = point ? scheduledMapPuzzleIds.has(point.id) : false;
                  return (
                    <li
                      className={`cursor-grab space-y-2 p-3 active:cursor-grabbing ${
                        mapNpcId === npc.id ? "bg-[var(--ember)]/10" : ""
                      }`}
                      draggable
                      key={npc.id}
                      onClick={() => {
                        setMapNpcId(npc.id);
                        setMapPoint(point ? { x: point.x, y: point.y } : null);
                        setChapterPl(point?.chapterPl ?? "");
                        setChapterEn(point?.chapterEn ?? "");
                        setChapterDe(point?.chapterDe ?? "");
                      }}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", npc.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-serif text-lg">{npcDisplayName(npc, "pl" as Locale)}</div>
                          <div className="text-xs text-[var(--bone-dim)]">{npc.id}</div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 text-[10px] uppercase tracking-widest">
                          {checked ? <span className="text-[var(--ember-bright)]">CHECKED</span> : null}
                          {point && !checked ? <span className="text-[var(--bone-dim)]">POINT</span> : null}
                        </div>
                      </div>
                      <button
                        className="border border-[var(--ember)] px-3 py-1 text-xs"
                        onClick={(event) => {
                          event.stopPropagation();
                          void assignMapNpcToDay(selectedMapDay, npc);
                        }}
                        type="button"
                      >
                        Do dnia {selectedMapDay}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
