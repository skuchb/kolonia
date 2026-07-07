import { isNotNull } from "drizzle-orm";
import { PLAYER_CAMPS } from "@/src/core/camp-war";
import type { PlayerCamp } from "@/src/core/types";
import { getDb } from "../../../db";
import { isStatsRateLimited } from "../../../db/rate-limit";
import { users } from "../../../db/schema";
import { parseUserState, readAccountStreak } from "../../../db/user-state";

const LEADERS_PER_CAMP = 5;

async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "0.0.0.0"
  );
}

function emptyResponse() {
  return {
    camps: PLAYER_CAMPS.map((camp) => ({ camp, leaders: [] })),
  };
}

export async function GET(request: Request) {
  const empty = emptyResponse();

  try {
    const db = getDb();
    const salt = process.env.IP_HASH_SALT ?? "kolonia-dev-salt";
    const ipHash = await hashIp(clientIp(request), salt);
    if (await isStatsRateLimited(db, ipHash)) {
      return Response.json(empty);
    }

    const rows = await db
      .select({
        displayName: users.displayName,
        camp: users.camp,
        stateJson: users.stateJson,
      })
      .from(users)
      .where(isNotNull(users.camp));

    const byCamp = new Map<PlayerCamp, { nick: string; streak: number; maxStreak: number }[]>();

    for (const camp of PLAYER_CAMPS) {
      byCamp.set(camp, []);
    }

    for (const row of rows) {
      if (!row.camp || !PLAYER_CAMPS.includes(row.camp as PlayerCamp)) continue;

      const state = parseUserState(row.stateJson);
      const camp = (state.camp ?? row.camp) as PlayerCamp;
      if (!PLAYER_CAMPS.includes(camp)) continue;

      const { streak, maxStreak } = readAccountStreak(state);
      if (streak < 1) continue;

      byCamp.get(camp)?.push({
        nick: row.displayName,
        streak,
        maxStreak,
      });
    }

    const camps = PLAYER_CAMPS.map((camp) => {
      const leaders = (byCamp.get(camp) ?? [])
        .sort((a, b) => b.streak - a.streak || b.maxStreak - a.maxStreak || a.nick.localeCompare(b.nick))
        .slice(0, LEADERS_PER_CAMP)
        .map(({ nick, streak }) => ({ nick, streak }));

      return { camp, leaders };
    });

    return Response.json({ camps });
  } catch {
    return Response.json(empty);
  }
}
