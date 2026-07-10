import type { Locale } from "./types";

export type PushSubscribeResult = "ok" | "denied" | "dismissed" | "unsupported" | "failed";

export type PushPermissionResult = {
  permission: NotificationPermission;
  /** Web API returned denied without showing a prompt (common on Android 13+ TWA). */
  instantDeny: boolean;
};

export function isAndroidDevice(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

/** Installed PWA or TWA (not the Chrome tab UI). */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

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

/** Opens Android notification settings for KOLONIA (TWA) or Chrome (browser). */
export function openAndroidNotificationSettings(): void {
  if (!isAndroidDevice()) return;
  const appPackage = isStandaloneDisplay() ? "app.kolonia.game" : "com.android.chrome";
  window.location.href = `intent:#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;S.android.provider.extra.APP_PACKAGE=${appPackage};end`;
}

/** Call as the first await from a click handler — before any other async work. */
export async function requestPushPermission(): Promise<PushPermissionResult> {
  if (!isPushSupported()) return { permission: "denied", instantDeny: false };

  const prior = Notification.permission;
  if (prior !== "default") return { permission: prior, instantDeny: false };

  const started = performance.now();
  const permission = await Notification.requestPermission();
  const instantDeny =
    permission === "denied" && isAndroidDevice() && performance.now() - started < 250;

  return { permission, instantDeny };
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
