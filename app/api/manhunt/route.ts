import { puzzleNumber } from "@/src/core/daily";
import type { PlayerCamp } from "@/src/core/types";
import { getDb } from "../../../db";
import { isResultRateLimited } from "../../../db/rate-limit";
import { results } from "../../../db/schema";

const MANHUNT_EVENTS = new Set([
  "manhunt_start",
  "manhunt_reveal_camp",
  "manhunt_reveal_guild",
  "manhunt_reveal_location",
  "manhunt_reveal_letter",
  "manhunt_reveal_teacher",
  "manhunt_reveal_trade",
  "manhunt_reveal_quote",
  "manhunt_zero",
  "manhunt_win",
  "manhunt_share",
]);

const CAMPS = new Set<PlayerCamp>(["OLD_CAMP", "NEW_CAMP", "SWAMP_CAMP"]);
const MISS_EVENT = /^manhunt_miss_(\d+)$/;
const REVEAL_EVENT = /^manhunt_reveal_(camp|guild|location|letter|teacher|trade|quote)$/;

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

function isValidEvent(event: string): boolean {
  if (MANHUNT_EVENTS.has(event)) return true;
  if (MISS_EVENT.test(event)) return true;
  if (REVEAL_EVENT.test(event)) return true;
  return false;
}

function isValidPayload(payload: unknown): payload is {
  event: string;
  day: number;
  field?: string;
  order?: number;
  nuggetsAfter?: number;
  reveals?: number;
  misses?: number;
  score?: number;
  ms?: number;
  camp?: string | null;
  userId?: string | null;
} {
  if (!payload || typeof payload !== "object") return false;

  const body = payload as Record<string, unknown>;
  if (typeof body.event !== "string" || !isValidEvent(body.event)) return false;
  if (typeof body.day !== "number" || !Number.isInteger(body.day) || body.day < 0) return false;

  const optionalNumbers = ["order", "nuggetsAfter", "reveals", "misses", "score", "ms"] as const;
  for (const key of optionalNumbers) {
    const value = body[key];
    if (value !== undefined && (typeof value !== "number" || !Number.isInteger(value) || value < 0)) {
      return false;
    }
  }

  if (body.camp !== undefined && body.camp !== null) {
    if (typeof body.camp !== "string" || !CAMPS.has(body.camp as PlayerCamp)) return false;
  }

  if (
    body.userId !== undefined &&
    body.userId !== null &&
    (typeof body.userId !== "string" || body.userId.length > 64)
  ) {
    return false;
  }

  const today = puzzleNumber();
  if (body.day < today - 1 || body.day > today + 1) return false;

  return true;
}

function mapPayloadToRow(payload: {
  event: string;
  day: number;
  order?: number;
  nuggetsAfter?: number;
  reveals?: number;
  misses?: number;
  score?: number;
  ms?: number;
}) {
  const event = payload.event;

  if (event === "manhunt_start") {
    return { attempts: 0, solved: 0, points: 0 };
  }

  if (event.startsWith("manhunt_reveal_")) {
    return {
      attempts: payload.order ?? 0,
      solved: 0,
      points: payload.nuggetsAfter ?? 0,
    };
  }

  const missMatch = event.match(MISS_EVENT);
  if (missMatch) {
    return {
      attempts: Number(missMatch[1]),
      solved: 0,
      points: payload.nuggetsAfter ?? 0,
    };
  }

  if (event === "manhunt_zero") {
    return {
      attempts: payload.reveals ?? 0,
      solved: 0,
      points: payload.misses ?? 0,
    };
  }

  if (event === "manhunt_win") {
    const score = payload.score ?? 0;
    return {
      attempts: payload.misses ?? 0,
      solved: 1,
      points: score,
    };
  }

  if (event === "manhunt_share") {
    return {
      attempts: payload.score ?? 0,
      solved: 1,
      points: 0,
    };
  }

  return { attempts: 0, solved: 0, points: 0 };
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

  const salt = process.env.IP_HASH_SALT ?? "kolonia-dev-salt";
  const ipHash = await hashIp(clientIp(request), salt);
  const mapped = mapPayloadToRow(payload);

  try {
    const db = getDb();
    if (await isResultRateLimited(db, ipHash)) {
      return new Response(null, { status: 429 });
    }

    await db
      .insert(results)
      .values({
        userId: payload.userId ?? null,
        mode: "manhunt",
        puzzle: payload.day,
        attempts: mapped.attempts,
        solved: mapped.solved,
        points: mapped.points,
        camp: payload.camp ?? null,
        ipHash,
        event: payload.event,
        ts: Date.now(),
      })
      .onConflictDoNothing();
  } catch {
    // Gra działa bez API — telemetria jest opcjonalna.
  }

  return new Response(null, { status: 204 });
}
