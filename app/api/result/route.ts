import { getDb } from "../../../db";
import { isResultRateLimited } from "../../../db/rate-limit";
import { results } from "../../../db/schema";
import { puzzleNumber } from "@/src/core/daily";
import type { ModeId } from "@/src/core/types";

const MODES = new Set<ModeId>(["classic", "quote", "map", "card"]);
const CAMPS = new Set(["OLD_CAMP", "NEW_CAMP", "SWAMP_CAMP"]);
const EVENTS = new Set(["solve", "share"]);

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

function isValidPayload(payload: unknown): payload is {
  mode: ModeId;
  puzzle: number;
  attempts: number;
  solved: boolean;
  camp: string | null;
  userId?: string | null;
  event?: "solve" | "share";
} {
  if (!payload || typeof payload !== "object") return false;

  const body = payload as Record<string, unknown>;
  const puzzle = body.puzzle;
  const attempts = body.attempts;
  const event = body.event ?? "solve";

  if (typeof body.mode !== "string" || !MODES.has(body.mode as ModeId)) return false;
  if (typeof puzzle !== "number" || !Number.isInteger(puzzle)) return false;
  if (typeof event !== "string" || !EVENTS.has(event)) return false;
  if (event === "solve") {
    if (typeof attempts !== "number" || !Number.isInteger(attempts) || attempts < 1 || attempts > 50) {
      return false;
    }
    if (typeof body.solved !== "boolean") return false;
  } else if (typeof attempts !== "number" || !Number.isInteger(attempts) || attempts < 0 || attempts > 50) {
    return false;
  }
  if (body.camp !== null && (typeof body.camp !== "string" || !CAMPS.has(body.camp))) return false;
  if (
    body.userId !== undefined &&
    body.userId !== null &&
    (typeof body.userId !== "string" || body.userId.length > 64)
  ) {
    return false;
  }

  const today = puzzleNumber();
  if (puzzle < today - 1 || puzzle > today + 1) return false;

  return true;
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  if (!isValidPayload(payload)) {
    return new Response(null, { status: 400 });
  }

  const event = payload.event ?? "solve";
  const solved = event === "solve" ? payload.solved : true;
  const attempts = event === "share" ? Math.max(0, payload.attempts) : payload.attempts;
  const points = solved && event === "solve" ? Math.max(1, 11 - attempts) : 0;
  const salt = process.env.IP_HASH_SALT ?? "kolonia-dev-salt";
  const ipHash = await hashIp(clientIp(request), salt);

  try {
    const db = getDb();
    if (await isResultRateLimited(db, ipHash)) {
      return new Response(null, { status: 429 });
    }

    await db
      .insert(results)
      .values({
        userId: payload.userId ?? null,
        mode: payload.mode,
        puzzle: payload.puzzle,
        attempts,
        solved: solved ? 1 : 0,
        points,
        camp: payload.camp,
        ipHash,
        event,
        ts: Date.now(),
      })
      .onConflictDoNothing();
  } catch {
    // Gra działa bez API — telemetria jest opcjonalna.
  }

  return new Response(null, { status: 204 });
}
