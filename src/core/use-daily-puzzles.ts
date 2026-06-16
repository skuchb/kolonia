"use client";

import { useEffect, useState } from "react";
import type { DailyMapPuzzle, ModeId, Npc, Quote } from "./types";
import {
  fallbackDailyCard,
  fallbackDailyClassic,
  fallbackDailyMap,
  fallbackDailyQuote,
  fetchDailyPuzzle,
  type DailyCardResponse,
  type DailyClassicResponse,
  type DailyMapResponse,
  type DailyQuoteResponse,
} from "./daily-api";

export function useDailyPuzzles(puzzle: number) {
  const [classicNpc, setClassicNpc] = useState<Npc | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [mapPuzzle, setMapPuzzle] = useState<DailyMapPuzzle | null>(null);
  const [cardNpc, setCardNpc] = useState<Npc | null>(null);
  const [loadedPuzzle, setLoadedPuzzle] = useState<number | null>(null);
  const [scheduled, setScheduled] = useState<Partial<Record<ModeId, boolean>>>({});

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [classicRes, quoteRes, mapRes, cardRes] = await Promise.all([
        fetchDailyPuzzle("classic", puzzle),
        fetchDailyPuzzle("quote", puzzle),
        fetchDailyPuzzle("map", puzzle),
        fetchDailyPuzzle("card", puzzle),
      ]);

      if (cancelled) return;

      const classic =
        classicRes?.mode === "classic"
          ? (classicRes as DailyClassicResponse).npc
          : fallbackDailyClassic(puzzle);
      const quoteItem =
        quoteRes?.mode === "quote" ? (quoteRes as DailyQuoteResponse).quote : fallbackDailyQuote(puzzle);
      const mapItem =
        mapRes?.mode === "map" ? (mapRes as DailyMapResponse) : fallbackDailyMap(puzzle);
      const cardItem =
        cardRes?.mode === "card" ? (cardRes as DailyCardResponse).npc : fallbackDailyCard(puzzle);

      setClassicNpc(classic);
      setQuote(quoteItem);
      setMapPuzzle(mapItem);
      setCardNpc(cardItem);
      setScheduled({
        classic: classicRes?.mode === "classic",
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
    classicNpc,
    quote,
    mapPuzzle,
    cardNpc,
    loading: loadedPuzzle !== puzzle,
    scheduled,
  };
}
