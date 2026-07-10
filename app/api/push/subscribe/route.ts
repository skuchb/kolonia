import { env } from "cloudflare:workers";
import type { Locale } from "@/src/core/types";
import { getUserFromRequest } from "../../../../db/user-from-request";
import { deletePushSubscription, upsertPushSubscription, type PushSubscriptionInput } from "../../../../db/push";

function parseSubscription(body: unknown): PushSubscriptionInput | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const endpoint = typeof record.endpoint === "string" ? record.endpoint.trim() : "";
  const keys = record.keys;
  if (!endpoint || !keys || typeof keys !== "object") return null;
  const keyRecord = keys as Record<string, unknown>;
  const p256dh = typeof keyRecord.p256dh === "string" ? keyRecord.p256dh.trim() : "";
  const auth = typeof keyRecord.auth === "string" ? keyRecord.auth.trim() : "";
  if (!p256dh || !auth) return null;
  return { endpoint, keys: { p256dh, auth } };
}

function parseLang(body: unknown): Locale {
  if (!body || typeof body !== "object") return "pl";
  const lang = (body as Record<string, unknown>).lang;
  if (lang === "en" || lang === "de") return lang;
  return "pl";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const subscription = parseSubscription(body);
  if (!subscription) {
    return Response.json({ error: "invalid_subscription" }, { status: 400 });
  }

  if (!env.DB) {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }

  const user = await getUserFromRequest(request);

  try {
    await upsertPushSubscription(env.DB, subscription, {
      userId: user?.id ?? null,
      lang: parseLang(body),
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const subscription = parseSubscription(body);
  if (!subscription) {
    return Response.json({ error: "invalid_subscription" }, { status: 400 });
  }

  if (!env.DB) {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }

  try {
    await deletePushSubscription(env.DB, subscription.endpoint);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
