import type { ModeId, ModeStats, Persisted, PlayerCamp } from "./types";
import type { ManhuntState, ManhuntStats } from "@/src/modes/manhunt/types";
import { applyRemoteGameState, buildRemoteGameState } from "./sync-state";

export const AUTH_KEY = "kolonia_auth";

export interface AuthSession {
  token: string;
  userId: string;
  nick: string;
}

export interface UserProfile {
  nick: string;
  camp: PlayerCamp | null;
  totalXp: number;
  stats: Partial<Record<ModeId, ModeStats>>;
  lang?: Persisted["lang"];
  modes?: Persisted["modes"];
  archive?: Persisted["archive"];
  manhuntDays?: Record<string, ManhuntState>;
  manhuntStats?: ManhuntStats;
}

export function loadAuth(): AuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed.token || !parsed.userId || !parsed.nick) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveAuth(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(AUTH_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

export function mergePersistedWithProfile(local: Persisted, profile: UserProfile): Persisted {
  return applyRemoteGameState(local, {
    lang: profile.lang,
    camp: profile.camp,
    totalXp: profile.totalXp,
    stats: profile.stats,
    modes: profile.modes,
    archive: profile.archive,
    manhuntDays: profile.manhuntDays,
    manhuntStats: profile.manhuntStats,
  });
}

export function profileFromPersisted(state: Persisted): Omit<UserProfile, "nick"> {
  return buildRemoteGameState(state);
}

export function startGoogleLogin() {
  if (typeof window === "undefined") return;
  window.location.href = "/api/auth/google/start";
}

export type GoogleAuthHashResult =
  | { kind: "session"; session: AuthSession; isNew: boolean }
  | { kind: "error"; code: string };

export function consumeGoogleAuthHash(): GoogleAuthHashResult | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const authError = params.get("auth_error");
  const encoded = params.get("auth");

  if (!authError && !encoded) return null;

  window.history.replaceState(null, "", window.location.pathname + window.location.search);

  if (authError) {
    return { kind: "error", code: authError };
  }

  try {
    const session = JSON.parse(encoded!) as AuthSession;
    if (!session.token || !session.userId || !session.nick) return null;
    saveAuth(session);
    return { kind: "session", session, isNew: true };
  } catch {
    return null;
  }
}

export async function fetchProfile(token: string): Promise<UserProfile | null> {
  const response = await fetch("/api/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) return null;
  return (await response.json()) as UserProfile;
}

export async function syncProfile(token: string, state: Persisted): Promise<UserProfile | null> {
  const response = await fetch("/api/me", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildRemoteGameState(state)),
  });

  if (!response.ok) return null;
  return (await response.json()) as UserProfile;
}
