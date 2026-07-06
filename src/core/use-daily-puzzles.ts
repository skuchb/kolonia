"use client";

import { useEffect, useState } from "react";
import type { DailyMapPuzzle, ModeId, Npc, Quote } from "./types";
import {
  fallbackDailyCard,
  fallbackDailyManhunt,
  fallbackDailyMap,
  fallbackDailyQuote,
  fetchDailyPuzzle,
  type DailyCardResponse,
  type DailyManhuntResponse,
  type DailyMapResponse,
  type DailyQuoteResponse,
} from "./daily-api";

export function useDailyPuzzles(puzzle: number) {
  const [manhuntNpc, setManhuntNpc] = useState<Npc | null>(null);
  const [manhuntQuote, setManhuntQuote] = useState<Quote | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [mapPuzzle, setMapPuzzle] = useState<DailyMapPuzzle | null>(null);
  const [cardNpc, setCardNpc] = useState<Npc | null>(null);
  const [loadedPuzzle, setLoadedPuzzle] = useState<number | null>(null);
  const [scheduled, setScheduled] = useState<Partial<Record<ModeId, boolean>>>({});

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [manhuntRes, quoteRes, mapRes, cardRes] = await Promise.all([
        fetchDailyPuzzle("manhunt", puzzle),
        fetchDailyPuzzle("quote", puzzle),
        fetchDailyPuzzle("map", puzzle),
        fetchDailyPuzzle("card", puzzle),
      ]);

      if (cancelled) return;

      const manhuntFromApi = manhuntRes?.mode === "manhunt" ? (manhuntRes as DailyManhuntResponse) : null;
      const manhunt = manhuntFromApi?.npc ?? fallbackDailyManhunt(puzzle);
      const manhuntQuoteItem = manhuntFromApi?.quote ?? null;
      const quoteItem =
        quoteRes?.mode === "quote" ? (quoteRes as DailyQuoteResponse).quote : fallbackDailyQuote(puzzle);
      const mapItem =
        mapRes?.mode === "map" ? (mapRes as DailyMapResponse) : fallbackDailyMap(puzzle);
      const cardItem =
        cardRes?.mode === "card" ? (cardRes as DailyCardResponse).npc : fallbackDailyCard(puzzle);

      setManhuntNpc(manhunt);
      setManhuntQuote(manhuntQuoteItem);
      setQuote(quoteItem);
      setMapPuzzle(mapItem);
      setCardNpc(cardItem);
      setScheduled({
        manhunt: manhuntRes?.mode === "manhunt",
        quote: quoteRes?.mode === "quote",
        map: mapRes?.mode === "map",
        card: cardRes?.mode === "card",
      });
      setLoadedPuzzle(puzzle);
    })();

    return () => {
      cancelled = true;
    };
  }, [puzzle]);

  return {
    manhuntNpc,
    manhuntQuote,
    quote,
    mapPuzzle,
    cardNpc,
    loading: loadedPuzzle !== puzzle,
    scheduled,
  };
}
