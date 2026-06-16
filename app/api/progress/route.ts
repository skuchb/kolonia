import { eq } from "drizzle-orm";
import { bearerToken, verifyToken } from "../../../db/auth";
import { getDb } from "../../../db";
import { userProgress } from "../../../db/schema";
import { rankForXp } from "@/src/core/xp";
import type { ModeId } from "@/src/core/types";

async function getUserId(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    const [row] = await db.select().from(userProgress).where(eq(userProgress.userId, userId)).limit(1);
    if (!row) {
      return Response.json({ totalXp: 0, rank: "digger", progress: {} });
    }
    const progress = JSON.parse(row.progressJson || "{}");
    return Response.json({
      totalXp: row.totalXp,
      rank: rankForXp(row.totalXp),
      progress,
    });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    mode?: ModeId;
    puzzle?: number;
    attempts?: number;
    xpEarned?: number;
    distanceMeters?: number | null;
    totalXp?: number;
    progress?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  if (
    !body.mode ||
    !Number.isInteger(body.puzzle) ||
    !Number.isInteger(body.attempts) ||
    !Number.isInteger(body.xpEarned) ||
    !Number.isInteger(body.totalXp)
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const db = getDb();
    const ts = Date.now();
    const [existing] = await db
      .select()
      .from(userProgress)
      .where(eq(userProgress.userId, userId))
      .limit(1);

    const nextXp = Math.max(existing?.totalXp ?? 0, body.totalXp);
    const progressJson = JSON.stringify(body.progress ?? {});

    if (existing) {
      await db
        .update(userProgress)
        .set({ totalXp: nextXp, progressJson, updatedAt: ts })
        .where(eq(userProgress.userId, userId));
    } else {
      await db.insert(userProgress).values({
        userId,
        totalXp: nextXp,
        progressJson,
        updatedAt: ts,
      });
    }

    const { userSolves: solvesTable } = await import("../../../db/schema");
    await db
      .insert(solvesTable)
      .values({
        userId,
        mode: body.mode,
        puzzle: body.puzzle!,
        attempts: body.attempts!,
        xpEarned: body.xpEarned!,
        distanceMeters: body.distanceMeters ?? null,
        solvedAt: ts,
      })
      .onConflictDoNothing();

    return Response.json({ totalXp: nextXp, rank: rankForXp(nextXp) });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
