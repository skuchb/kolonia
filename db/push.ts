import { desc, eq } from "drizzle-orm";
import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import webpush from "web-push";
import type { Locale } from "@/src/core/types";
import { puzzleNumber, TIMEZONE } from "@/src/core/daily";
import { siteUrl } from "@/src/core/site";
import { pushSubscriptions } from "./schema";

const DEFAULT_DAILY_PUSH_HOUR_WARSAW = 14;

function readDailyPushHourWarsaw(): number {
  const raw = process.env.DAILY_PUSH_HOUR_WARSAW?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_DAILY_PUSH_HOUR_WARSAW;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 23) {
    return DEFAULT_DAILY_PUSH_HOUR_WARSAW;
  }
  return parsed;
}

const DAILY_PUSH_COPY: Record<Locale, { title: string; body: string }> = {
  pl: {
    title: "KOLONIA",
    body: "Nowa zagadka czeka w Kolonii. Zgadniesz dzisiejszą postać?",
  },
  en: {
    title: "KOLONIA",
    body: "A new puzzle awaits in Kolonia. Can you guess today's character?",
  },
  de: {
    title: "KOLONIA",
    body: "Ein neues Rätsel wartet in Kolonia. Errätst du die heutige Figur?",
  },
};

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

function drizzleDb(d1: D1Database) {
  return drizzle(d1, { schema: { pushSubscriptions } });
}

export function readVapidConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:contact@kolonia.app";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function configureWebPush(config: VapidConfig): void {
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
}

function normalizeLang(value: string | undefined): Locale {
  if (value === "en" || value === "de") return value;
  return "pl";
}

function isExpiredPushError(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}

export async function upsertPushSubscription(
  d1: D1Database,
  subscription: PushSubscriptionInput,
  options: { userId?: string | null; lang?: Locale },
): Promise<void> {
  const db = drizzleDb(d1);
  const now = Date.now();
  const lang = options.lang ?? "pl";
  const [existing] = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
    .limit(1);

  if (existing) {
    await db
      .update(pushSubscriptions)
      .set({
        userId: options.userId ?? null,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        lang,
        updatedAt: now,
      })
      .where(eq(pushSubscriptions.id, existing.id));
    return;
  }

  await db.insert(pushSubscriptions).values({
    userId: options.userId ?? null,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    lang,
    createdAt: now,
    updatedAt: now,
  });
}

export async function deletePushSubscription(d1: D1Database, endpoint: string): Promise<void> {
  const db = drizzleDb(d1);
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function sendPushNotification(
  config: VapidConfig,
  subscription: PushSubscriptionInput,
  payload: { title: string; body: string; url: string },
): Promise<{ ok: boolean; statusCode?: number }> {
  configureWebPush(config);
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (error) {
    const statusCode =
      typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : undefined;
    return { ok: false, statusCode };
  }
}

function warsawHour(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIMEZONE,
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
}

export function shouldSendDailyPush(now = new Date()): boolean {
  return warsawHour(now) === readDailyPushHourWarsaw();
}

export async function sendDailyPuzzlePushes(
  d1: D1Database,
  options: { force?: boolean } = {},
): Promise<{
  sent: number;
  failed: number;
  removed: number;
  skipped: boolean;
}> {
  if (!options.force && !shouldSendDailyPush()) {
    return { sent: 0, failed: 0, removed: 0, skipped: true };
  }

  const config = readVapidConfig();
  if (!config) {
    return { sent: 0, failed: 0, removed: 0, skipped: true };
  }

  const db = drizzleDb(d1);
  const rows = await db.select().from(pushSubscriptions);
  const day = puzzleNumber();
  const baseUrl = siteUrl();
  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const row of rows) {
    const lang = normalizeLang(row.lang);
    const copy = DAILY_PUSH_COPY[lang];
    const result = await sendPushNotification(
      config,
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      {
        title: copy.title,
        body: copy.body,
        url: `${baseUrl}/?day=${day}`,
      },
    );

    if (result.ok) {
      sent += 1;
      continue;
    }

    if (isExpiredPushError(result.statusCode)) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, row.id));
      removed += 1;
      continue;
    }

    failed += 1;
  }

  return { sent, failed, removed, skipped: false };
}

export async function listPushSubscriptionsForAdmin(d1: D1Database): Promise<
  Array<{
    id: number;
    endpointPreview: string;
    lang: string;
    updatedAt: number;
  }>
> {
  const db = drizzleDb(d1);
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .orderBy(desc(pushSubscriptions.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    endpointPreview: row.endpoint.length > 56 ? `${row.endpoint.slice(0, 56)}…` : row.endpoint,
    lang: row.lang,
    updatedAt: row.updatedAt,
  }));
}
