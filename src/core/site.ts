export const DEFAULT_SITE_URL = "https://kolonia.app";
export const DEFAULT_SITE_HOST = "kolonia.app";

export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return DEFAULT_SITE_URL;
  return raw.replace(/\/$/, "");
}

export function shareDomain(): string {
  try {
    return new URL(siteUrl()).host;
  } catch {
    return DEFAULT_SITE_HOST;
  }
}
