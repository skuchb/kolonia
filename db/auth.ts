const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function authSecret(): string {
  return process.env.AUTH_SECRET ?? "kolonia-dev-auth-secret";
}

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function createUserId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function signToken(userId: string): Promise<string> {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  const sig = await hmac(`${userId}.${exp}`);
  return `${userId}.${exp}.${sig}`;
}

export async function verifyToken(token: string): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [userId, exp, sig] = parts;
  if (!userId || !exp || !sig) return null;
  if (Number(exp) < Date.now()) return null;

  const expected = await hmac(`${userId}.${exp}`);
  if (expected !== sig) return null;

  return userId;
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export function googleOAuthConfig(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

export function oauthCookie(value: string, maxAgeSeconds: number) {
  return [
    `kolonia_oauth_state=${value}`,
    "Path=/api/auth/google",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ].join("; ");
}

export function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;

  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || null;
  }

  return null;
}
