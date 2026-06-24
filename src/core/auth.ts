import type { ModeId, ModeStats, Persisted, PlayerCamp } from "./types";

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

function mergeStats(local: ModeStats, remote: ModeStats): ModeStats {
  const dist = { ...remote.dist };
  for (const [attempts, count] of Object.entries(local.dist)) {
    dist[attempts] = Math.max(dist[attempts] ?? 0, count);
  }

  return {
    played: Math.max(local.played, remote.played),
    won: Math.max(local.won, remote.won),
    streak: Math.max(local.streak, remote.streak),
    maxStreak: Math.max(local.maxStreak, remote.maxStreak),
    lastWonPuzzle: Math.max(local.lastWonPuzzle, remote.lastWonPuzzle),
    dist,
  };
}

export function mergePersistedWithProfile(local: Persisted, profile: UserProfile): Persisted {
  const stats = { ...local.stats };
  for (const mode of ["classic", "quote", "map", "card"] as const) {
    const localStats = local.stats[mode];
    const remoteStats = profile.stats[mode];
    if (localStats && remoteStats) {
      stats[mode] = mergeStats(localStats, remoteStats);
    } else if (remoteStats) {
      stats[mode] = remoteStats;
    }
  }

  return {
    ...local,
    lang: profile.lang ?? local.lang,
    camp: profile.camp ?? local.camp,
    totalXp: Math.max(local.totalXp ?? 0, profile.totalXp ?? 0),
    stats,
  };
}

export function profileFromPersisted(state: Persisted): Pick<UserProfile, "camp" | "stats" | "lang" | "totalXp"> {
  return {
    camp: state.camp,
    totalXp: state.totalXp ?? 0,
    stats: state.stats,
    lang: state.lang,
  };
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
    body: JSON.stringify(profileFromPersisted(state)),
  });

  if (!response.ok) return null;
  return (await response.json()) as UserProfile;
}
