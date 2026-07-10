import type { Locale } from "./types";

export type PushSubscribeResult = "ok" | "denied" | "dismissed" | "unsupported" | "failed";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

async function fetchVapidPublicKey(): Promise<string | null> {
  const response = await fetch("/api/push/vapid-public-key");
  if (!response.ok) return null;
  const data = (await response.json()) as { publicKey?: string };
  return data.publicKey?.trim() || null;
}

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const raw = window.localStorage.getItem("kolonia_auth");
    if (!raw) return headers;
    const parsed = JSON.parse(raw) as { token?: string };
    if (parsed.token) headers.Authorization = `Bearer ${parsed.token}`;
  } catch {
    // Anonymous push subscription is allowed.
  }
  return headers;
}

/** Call as the first await from a click handler — before any other async work. */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

export async function subscribeToPush(lang: Locale): Promise<PushSubscribeResult> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission !== "granted") {
    return Notification.permission === "denied" ? "denied" : "dismissed";
  }

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) return "failed";

  await navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  const registration = await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const payload = subscription.toJSON();
  if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys.auth) return "failed";

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      endpoint: payload.endpoint,
      keys: payload.keys,
      lang,
    }),
  });

  return response.ok ? "ok" : "failed";
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;

  await navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const payload = subscription.toJSON();
  if (payload.endpoint) {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: authHeaders(),
      body: JSON.stringify({
        endpoint: payload.endpoint,
        keys: payload.keys,
      }),
    }).catch(() => undefined);
  }

  await subscription.unsubscribe().catch(() => undefined);
}

export async function syncPushSubscription(
  lang: Locale,
  enabled: boolean,
  permission: NotificationPermission = Notification.permission,
): Promise<PushSubscribeResult> {
  if (!enabled) {
    await unsubscribeFromPush();
    return "ok";
  }
  if (permission !== "granted") {
    return permission === "denied" ? "denied" : "dismissed";
  }
  return subscribeToPush(lang);
}
