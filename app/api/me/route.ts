import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { userProgress, users } from "../../../db/schema";
import { getUserFromRequest } from "../../../db/user-from-request";
import {
  mergeUserState,
  parseUserState,
  serializeUserState,
  type StoredUserState,
} from "../../../db/user-state";
import { rankForXp } from "@/src/core/xp";

async function readTotalXp(userId: string): Promise<number> {
  try {
    const db = getDb();
    const [row] = await db.select().from(userProgress).where(eq(userProgress.userId, userId)).limit(1);
    return row?.totalXp ?? 0;
  } catch {
    return 0;
  }
}

function toProfile(user: { displayName: string; stateJson: string }, totalXp: number) {
  const state = parseUserState(user.stateJson);
  const xp = Math.max(totalXp, state.totalXp ?? 0);
  return {
    nick: user.displayName,
    camp: state.camp ?? null,
    totalXp: xp,
    rank: rankForXp(xp),
    stats: state.stats ?? {},
    lang: state.lang,
  };
}

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const totalXp = await readTotalXp(user.id);
  return Response.json(toProfile(user, totalXp));
}

export async function PUT(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let incoming: StoredUserState;
  try {
    incoming = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const db = getDb();
    const current = parseUserState(user.stateJson);
    const merged = mergeUserState(current, incoming);
    const totalXp = Math.max(merged.totalXp ?? 0, await readTotalXp(user.id));

    await db
      .update(users)
      .set({
        camp: merged.camp ?? null,
        stateJson: serializeUserState({ ...merged, totalXp }),
      })
      .where(eq(users.id, user.id));

    const [progressRow] = await db
      .select()
      .from(userProgress)
      .where(eq(userProgress.userId, user.id))
      .limit(1);

    if (progressRow) {
      await db
        .update(userProgress)
        .set({ totalXp, progressJson: serializeUserState(merged), updatedAt: Date.now() })
        .where(eq(userProgress.userId, user.id));
    } else {
      await db.insert(userProgress).values({
        userId: user.id,
        totalXp,
        progressJson: serializeUserState(merged),
        updatedAt: Date.now(),
      });
    }

    return Response.json(toProfile({ displayName: user.displayName, stateJson: serializeUserState(merged) }, totalXp));
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
