import { eq } from "drizzle-orm";
import {
  createUserId,
  googleOAuthConfig,
  oauthCookie,
  readCookie,
  signToken,
} from "../../../../../db/auth";
import { getDb } from "../../../../../db";
import { users } from "../../../../../db/schema";

interface GoogleTokenResponse {
  id_token?: string;
}

interface GoogleTokenInfo {
  aud?: string;
  sub?: string;
  name?: string;
}

function redirectWithHash(request: Request, params: Record<string, string>) {
  const url = new URL("/", request.url);
  const hashParams = new URLSearchParams(params);
  url.hash = hashParams.toString();
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Set-Cookie": oauthCookie("", 0),
    },
  });
}

async function exchangeCode(code: string, request: Request) {
  const config = googleOAuthConfig(request);
  if (!config) return null;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) return null;
  const token = (await response.json()) as GoogleTokenResponse;
  if (!token.id_token) return null;

  const infoResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token.id_token)}`,
  );
  if (!infoResponse.ok) return null;

  const info = (await infoResponse.json()) as GoogleTokenInfo;
  if (info.aud !== config.clientId || !info.sub) return null;

  return {
    googleSub: info.sub,
    displayName: info.name?.trim() || "Google user",
  };
}

async function sessionForGoogleUser(googleSub: string, displayName: string) {
  const userId = `google_${googleSub}`;
  const token = await signToken(userId);
  return JSON.stringify({ token, userId, nick: displayName });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = readCookie(request, "kolonia_oauth_state");

  if (!code || !state || !savedState || state !== savedState) {
    return redirectWithHash(request, { auth_error: "invalid_state" });
  }

  try {
    const googleProfile = await exchangeCode(code, request);
    if (!googleProfile) {
      return redirectWithHash(request, { auth_error: "google_failed" });
    }

    let session: string;

    try {
      const db = getDb();
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.googleSub, googleProfile.googleSub))
        .limit(1);

      const userId = existing?.id ?? createUserId();
      const displayName = googleProfile.displayName;

      if (existing) {
        await db
          .update(users)
          .set({ displayName })
          .where(eq(users.id, existing.id));
      } else {
        await db.insert(users).values({
          id: userId,
          googleSub: googleProfile.googleSub,
          displayName,
          camp: null,
          role: "user",
          stateJson: "{}",
          created: Date.now(),
        });
      }

      const token = await signToken(userId);
      session = JSON.stringify({ token, userId, nick: displayName });
    } catch {
      // Local/dev fallback: Google login can still be tested without D1.
      session = await sessionForGoogleUser(googleProfile.googleSub, googleProfile.displayName);
    }

    return redirectWithHash(request, { auth: session });
  } catch {
    return redirectWithHash(request, { auth_error: "unavailable" });
  }
}
