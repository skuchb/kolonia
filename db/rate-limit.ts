import { and, eq, gt, sql } from "drizzle-orm";
import type { getDb } from "./index";
import { results } from "./schema";

const WINDOW_MS = 60_000;
const MAX_RESULT_EVENTS = 8;
const MAX_STATS_REQUESTS = 40;

type Db = ReturnType<typeof getDb>;

async function recentEventCount(db: Db, ipHash: string): Promise<number> {
  const since = Date.now() - WINDOW_MS;
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(results)
    .where(and(eq(results.ipHash, ipHash), gt(results.ts, since)));

  return row?.count ?? 0;
}

export async function isResultRateLimited(db: Db, ipHash: string): Promise<boolean> {
  return (await recentEventCount(db, ipHash)) >= MAX_RESULT_EVENTS;
}

export async function isStatsRateLimited(db: Db, ipHash: string): Promise<boolean> {
  return (await recentEventCount(db, ipHash)) >= MAX_STATS_REQUESTS;
}
