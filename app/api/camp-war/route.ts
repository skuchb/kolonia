import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  CAMP_WAR_MIN_SOLVES,
  EMPTY_CAMP_WAR_STATS,
  PLAYER_CAMPS,
  puzzleWeekRange,
} from "@/src/core/camp-war";
import { puzzleNumber } from "@/src/core/daily";
import type { PlayerCamp } from "@/src/core/types";
import { getDb } from "../../../db";
import { isStatsRateLimited } from "../../../db/rate-limit";
import { results } from "../../../db/schema";

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

function emptyForPuzzle(puzzle: number) {
  const range = puzzleWeekRange(puzzle);
  return {
    ...EMPTY_CAMP_WAR_STATS,
    week: range.week,
    day: range.day,
    startPuzzle: range.startPuzzle,
    endPuzzle: range.endPuzzle,
  };
}

function isValidWeekPuzzle(puzzle: number, today: number) {
  const weekStart = Math.floor(puzzle / 7) * 7;
  const todayWeekStart = Math.floor(today / 7) * 7;
  return weekStart >= todayWeekStart - 7 && weekStart <= todayWeekStart;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const puzzleParam = url.searchParams.get("puzzle");
  const puzzle = Number(puzzleParam);

  if (!Number.isInteger(puzzle) || puzzle < 0) {
    return Response.json({ error: "invalid puzzle" }, { status: 400 });
  }

  const today = puzzleNumber();
  if (!isValidWeekPuzzle(puzzle, today)) {
    return Response.json({ error: "invalid puzzle" }, { status: 400 });
  }

  const range = puzzleWeekRange(puzzle);
  const empty = emptyForPuzzle(puzzle);

  try {
    const db = getDb();
    const salt = process.env.IP_HASH_SALT ?? "kolonia-dev-salt";
    const ipHash = await hashIp(clientIp(request), salt);
    if (await isStatsRateLimited(db, ipHash)) {
      return Response.json(empty);
    }

    const rows = await db
      .select({
        camp: results.camp,
        solves: sql<number>`count(*)`.mapWith(Number),
        totalPoints: sql<number>`coalesce(sum(${results.points}), 0)`.mapWith(Number),
        avgPoints: sql<number | null>`avg(${results.points})`.mapWith(Number),
        avgAttempts: sql<number | null>`avg(${results.attempts})`.mapWith(Number),
      })
      .from(results)
      .where(
        and(
          eq(results.event, "solve"),
          eq(results.solved, 1),
          gte(results.puzzle, range.startPuzzle),
          lte(results.puzzle, range.endPuzzle),
          inArray(results.camp, PLAYER_CAMPS),
        ),
      )
      .groupBy(results.camp);

    const byCamp = new Map<PlayerCamp, (typeof rows)[number]>();
    for (const row of rows) {
      if (row.camp && PLAYER_CAMPS.includes(row.camp as PlayerCamp)) {
        byCamp.set(row.camp as PlayerCamp, row);
      }
    }

    const totalSolves = rows.reduce((sum, row) => sum + row.solves, 0);

    const camps = PLAYER_CAMPS.map((camp) => {
      const row = byCamp.get(camp);
      const solves = row?.solves ?? 0;
      const avgPoints = row?.avgPoints ?? 0;
      const avgAttempts = row?.avgAttempts ?? 0;
      return {
        camp,
        solves,
        totalPoints: row?.totalPoints ?? 0,
        avgPoints: solves > 0 ? Math.round(avgPoints * 10) / 10 : 0,
        avgAttempts: solves > 0 ? Math.round(avgAttempts * 10) / 10 : 0,
        sharePct: totalSolves > 0 ? Math.round((solves / totalSolves) * 100) : 0,
      };
    }).sort((a, b) => b.avgPoints - a.avgPoints || b.solves - a.solves);

    const ranked = camps.filter((camp) => camp.solves > 0);
    const leader = ranked.length > 0 ? ranked[0]!.camp : null;
    const ready = camps.every((camp) => camp.solves >= CAMP_WAR_MIN_SOLVES);

    return Response.json({
      week: range.week,
      day: range.day,
      startPuzzle: range.startPuzzle,
      endPuzzle: range.endPuzzle,
      totalSolves,
      camps,
      leader,
      ready,
    });
  } catch {
    return Response.json(empty);
  }
}
