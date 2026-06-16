import type { ModeId, PlayerCamp } from "./types";

export interface ResultPayload {
  mode: ModeId;
  puzzle: number;
  attempts: number;
  solved: boolean;
  camp: PlayerCamp | null;
  userId?: string | null;
  event?: "solve" | "share";
}

export function sendShareEvent(payload: Omit<ResultPayload, "solved" | "event">) {
  sendResult({ ...payload, solved: true, event: "share" });
}

export function sendResult(payload: ResultPayload) {
  if (typeof window === "undefined") return;

  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/result", blob)) return;
    }
  } catch {
    // fire-and-forget
  }

  void fetch("/api/result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
