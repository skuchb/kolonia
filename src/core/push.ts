import type { Locale } from "./types";

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

function authHeaders(): HeadersInit | undefined {
  try {
    const raw = window.localStorage.getItem("kolonia_auth");
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { token?: string };
    if (!parsed.token) return undefined;
    return { Authorization: `Bearer ${parsed.token}`, "Content-Type": "application/json" };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

export async function subscribeToPush(lang: Locale): Promise<"ok" | "denied" | "unsupported" | "failed"> {
  if (!isPushSupported()) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) return "failed";

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

export async function syncPushSubscription(lang: Locale, enabled: boolean): Promise<"ok" | "denied" | "unsupported" | "failed"> {
  if (!enabled) {
    await unsubscribeFromPush();
    return "ok";
  }
  return subscribeToPush(lang);
}
