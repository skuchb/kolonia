import { and, desc, eq, sql } from "drizzle-orm";
import { LAUNCH_DAY } from "@/src/core/daily";
import type { ModeId } from "@/src/core/types";
import { requireAdmin } from "../../../../db/admin";
import { listAdminSnapshot } from "../../../../db/cms-write";
import { getDb } from "../../../../db";
import { results, userSolves, users } from "../../../../db/schema";

const MODES: ModeId[] = ["classic", "quote", "map", "card"];

function dateForPuzzle(day: number) {
  const date = new Date(`${LAUNCH_DAY}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + day);
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

async function countRegisteredUsers(db: ReturnType<typeof getDb>) {
  const [row] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(users);
  return row?.count ?? 0;
}

async function statsForMode(db: ReturnType<typeof getDb>, puzzle: number, mode: ModeId) {
  const solveFilter = and(
    eq(results.mode, mode),
    eq(results.puzzle, puzzle),
    eq(results.event, "solve"),
    eq(results.solved, 1),
  );

  const [aggregate] = await db
    .select({
      solves: sql<number>`count(*)`.mapWith(Number),
      avgAttempts: sql<number | null>`avg(${results.attempts})`.mapWith(Number),
      loggedIn: sql<number>`coalesce(sum(case when ${results.userId} is not null then 1 else 0 end), 0)`.mapWith(
        Number,
      ),
    })
    .from(results)
    .where(solveFilter);

  const [shareRow] = await db
    .select({ shares: sql<number>`count(*)`.mapWith(Number) })
    .from(results)
    .where(and(eq(results.mode, mode), eq(results.puzzle, puzzle), eq(results.event, "share")));

  const attemptDistribution = await db
    .select({
      attempts: results.attempts,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(results)
    .where(solveFilter)
    .groupBy(results.attempts)
    .orderBy(results.attempts);

  const byCamp = await db
    .select({
      camp: results.camp,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(results)
    .where(solveFilter)
    .groupBy(results.camp)
    .orderBy(desc(sql`count(*)`));

  const [accountRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(userSolves)
    .where(and(eq(userSolves.mode, mode), eq(userSolves.puzzle, puzzle)));

  const solves = aggregate?.solves ?? 0;
  const avgAttempts = aggregate?.avgAttempts ?? 0;

  return {
    solves,
    shares: shareRow?.shares ?? 0,
    avgAttempts: solves > 0 ? Math.round(avgAttempts * 10) / 10 : 0,
    telemetryLoggedIn: aggregate?.loggedIn ?? 0,
    accountSolves: accountRow?.count ?? 0,
    attemptDistribution,
    byCamp: byCamp.map((row) => ({
      camp: row.camp ?? "unknown",
      count: row.count,
    })),
  };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const puzzleParam = url.searchParams.get("puzzle");

  try {
    const db = getDb();

    if (puzzleParam === null) {
      const rows = await db
        .select({
          puzzle: results.puzzle,
          mode: results.mode,
          solves: sql<number>`count(*)`.mapWith(Number),
          avgAttempts: sql<number | null>`avg(${results.attempts})`.mapWith(Number),
        })
        .from(results)
        .where(and(eq(results.event, "solve"), eq(results.solved, 1)))
        .groupBy(results.puzzle, results.mode)
        .orderBy(desc(results.puzzle), results.mode);

      return Response.json({
        registeredUsers: await countRegisteredUsers(db),
        overview: rows.map((row) => ({
          puzzle: row.puzzle,
          date: dateForPuzzle(row.puzzle),
          mode: row.mode,
          solves: row.solves,
          avgAttempts: row.avgAttempts ? Math.round(row.avgAttempts * 10) / 10 : 0,
        })),
      });
    }

    const puzzle = Number(puzzleParam);
    if (!Number.isInteger(puzzle) || puzzle < 0) {
      return Response.json({ error: "invalid_puzzle" }, { status: 400 });
    }

    const snapshot = await listAdminSnapshot();
    const schedule = snapshot.dailyPuzzles.filter((row) => row.puzzle === puzzle);

    const modes = Object.fromEntries(
      await Promise.all(MODES.map(async (mode) => [mode, await statsForMode(db, puzzle, mode)])),
    ) as Record<ModeId, Awaited<ReturnType<typeof statsForMode>>>;

    return Response.json({
      puzzle,
      date: dateForPuzzle(puzzle),
      registeredUsers: await countRegisteredUsers(db),
      schedule,
      modes,
      telemetryNote:
        "Telemetria zapisuje wyłącznie rozwiązania (unikalne IP na dzień i tryb).",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "stats_unavailable";
    return Response.json({ error: message }, { status: 503 });
  }
}
