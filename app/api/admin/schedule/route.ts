import type { ModeId } from "@/src/core/types";
import { auditLog, requireAdmin } from "../../../../db/admin";
import { upsertDailyPuzzle } from "../../../../db/cms-write";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const puzzle = url.searchParams.get("puzzle");
  const mode = url.searchParams.get("mode") as ModeId | null;

  const { listAdminSnapshot } = await import("../../../../db/cms-write");
  const snapshot = await listAdminSnapshot();
  const rows = snapshot.dailyPuzzles.filter((row) => {
    if (puzzle !== null && row.puzzle !== Number(puzzle)) return false;
    if (mode && row.mode !== mode) return false;
    return true;
  });
  return Response.json({ schedule: rows });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  let body: {
    puzzle: number;
    mode: ModeId;
    npcId?: string | null;
    quoteId?: string | null;
    mapPuzzleId?: number | null;
    published?: number;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!Number.isInteger(body.puzzle) || body.puzzle < 0 || !body.mode) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const id = await upsertDailyPuzzle(body);
    await auditLog(auth.user.id, "upsert_schedule", "daily_puzzle", String(body.puzzle), body);
    return Response.json({ ok: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "cms_write_failed";
    return Response.json({ error: message }, { status: 503 });
  }
}
