import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { isStatsRateLimited } from "../../../db/rate-limit";
import { results } from "../../../db/schema";
import { puzzleNumber } from "@/src/core/daily";
import type { ModeId } from "@/src/core/types";

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

const MODES = new Set<ModeId>(["classic", "quote", "card"]);
const MIN_PLAYERS = 30;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  const puzzleParam = url.searchParams.get("puzzle");
  const attemptsParam = url.searchParams.get("attempts");

  if (!mode || !MODES.has(mode as ModeId)) {
    return Response.json({ error: "invalid mode" }, { status: 400 });
  }

  const puzzle = Number(puzzleParam);
  if (!Number.isInteger(puzzle)) {
    return Response.json({ error: "invalid puzzle" }, { status: 400 });
  }

  const today = puzzleNumber();
  if (puzzle < today - 1 || puzzle > today + 1) {
    return Response.json({ error: "invalid puzzle" }, { status: 400 });
  }

  let attempts: number | undefined;
  if (attemptsParam !== null) {
    attempts = Number(attemptsParam);
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 50) {
      return Response.json({ error: "invalid attempts" }, { status: 400 });
    }
  }

  const empty = {
    players: 0,
    solved: 0,
    solvedPct: 0,
    avgAttempts: 0,
    ready: false,
  };

  try {
    const db = getDb();
    const salt = process.env.IP_HASH_SALT ?? "kolonia-dev-salt";
    const ipHash = await hashIp(clientIp(request), salt);
    if (await isStatsRateLimited(db, ipHash)) {
      return Response.json(empty);
    }

    const filter = and(
      eq(results.mode, mode),
      eq(results.puzzle, puzzle),
      eq(results.event, "solve"),
    );

    const [aggregate] = await db
      .select({
        players: sql<number>`count(*)`.mapWith(Number),
        solved: sql<number>`coalesce(sum(case when ${results.solved} = 1 then 1 else 0 end), 0)`.mapWith(
          Number,
        ),
        avgAttempts: sql<number>`avg(case when ${results.solved} = 1 then ${results.attempts} end)`.mapWith(
          Number,
        ),
      })
      .from(results)
      .where(filter);

    const players = aggregate?.players ?? 0;
    const solved = aggregate?.solved ?? 0;
    const solvedPct = players > 0 ? Math.round((solved / players) * 100) : 0;
    const avgAttempts = aggregate?.avgAttempts ?? 0;

    let percentile: number | undefined;
    if (attempts !== undefined && players >= MIN_PLAYERS && solved > 0) {
      const [worse] = await db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(results)
        .where(and(filter, eq(results.solved, 1), gt(results.attempts, attempts)));

      percentile = Math.min(99, Math.round(((worse?.count ?? 0) / solved) * 100));
    }

    return Response.json({
      players,
      solved,
      solvedPct,
      avgAttempts: Math.round(avgAttempts * 10) / 10,
      percentile,
      ready: players >= MIN_PLAYERS,
    });
  } catch {
    return Response.json(empty);
  }
}
