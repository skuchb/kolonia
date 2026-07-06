import type { PlayerCamp } from "@/src/core/types";
import type { ManhuntFieldId } from "./types";

export type ManhuntTelemetryEvent =
  | "manhunt_start"
  | `manhunt_reveal_${ManhuntFieldId}`
  | `manhunt_miss_${number}`
  | "manhunt_zero"
  | "manhunt_win"
  | "manhunt_share";

export interface ManhuntTelemetryPayload {
  event: ManhuntTelemetryEvent;
  day: number;
  field?: ManhuntFieldId;
  order?: number;
  nuggetsAfter?: number;
  reveals?: number;
  misses?: number;
  score?: number;
  ms?: number;
  camp?: PlayerCamp | null;
  userId?: string | null;
}

function revealEventName(field: ManhuntFieldId): ManhuntTelemetryEvent {
  return `manhunt_reveal_${field}`;
}

function missEventName(index: number): ManhuntTelemetryEvent {
  return `manhunt_miss_${index}`;
}

export function sendManhuntTelemetry(payload: ManhuntTelemetryPayload) {
  if (typeof window === "undefined") return;

  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/manhunt", blob)) return;
    }
  } catch {
    // fire-and-forget
  }

  void fetch("/api/manhunt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function trackManhuntStart(day: number, camp: PlayerCamp | null, userId: string | null) {
  sendManhuntTelemetry({ event: "manhunt_start", day, camp, userId });
}

export function trackManhuntReveal(
  day: number,
  field: ManhuntFieldId,
  order: number,
  nuggetsAfter: number,
  camp: PlayerCamp | null,
  userId: string | null,
) {
  sendManhuntTelemetry({
    event: revealEventName(field),
    day,
    field,
    order,
    nuggetsAfter,
    camp,
    userId,
  });
}

export function trackManhuntMiss(
  day: number,
  missIndex: number,
  nuggetsAfter: number,
  camp: PlayerCamp | null,
  userId: string | null,
) {
  sendManhuntTelemetry({
    event: missEventName(missIndex),
    day,
    nuggetsAfter,
    camp,
    userId,
  });
}

export function trackManhuntZero(
  day: number,
  reveals: number,
  misses: number,
  camp: PlayerCamp | null,
  userId: string | null,
) {
  sendManhuntTelemetry({ event: "manhunt_zero", day, reveals, misses, camp, userId });
}

export function trackManhuntWin(
  day: number,
  score: number,
  reveals: number,
  misses: number,
  ms: number,
  camp: PlayerCamp | null,
  userId: string | null,
) {
  sendManhuntTelemetry({ event: "manhunt_win", day, score, reveals, misses, ms, camp, userId });
}

export function trackManhuntShare(
  day: number,
  score: number,
  camp: PlayerCamp | null,
  userId: string | null,
) {
  sendManhuntTelemetry({ event: "manhunt_share", day, score, camp, userId });
}
