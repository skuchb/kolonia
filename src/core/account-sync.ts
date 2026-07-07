import { loadAuth } from "./auth";
import { loadPersisted } from "./storage";
import { buildRemoteGameState } from "./sync-state";
import type { Persisted } from "./types";

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncInFlight = false;
let syncQueued = false;

export function scheduleAccountSync(state?: Persisted) {
  const session = loadAuth();
  if (!session) return;

  const payload = state ?? loadPersisted();
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void flushAccountSync(session.token, payload);
  }, 700);
}

async function flushAccountSync(token: string, state: Persisted) {
  if (syncInFlight) {
    syncQueued = true;
    return;
  }

  syncInFlight = true;
  try {
    await fetch("/api/me", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildRemoteGameState(state)),
    });
  } finally {
    syncInFlight = false;
    if (syncQueued) {
      syncQueued = false;
      const session = loadAuth();
      if (session) void flushAccountSync(session.token, loadPersisted());
    }
  }
}
