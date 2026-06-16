import { eq } from "drizzle-orm";
import { bearerToken, verifyToken } from "./auth";
import { getDb } from "./index";
import { users } from "./schema";

function adminGoogleSubs(): Set<string> {
  const raw = process.env.ADMIN_GOOGLE_SUBS ?? "";
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function googleSubFromUserId(userId: string): string | null {
  if (!userId.startsWith("google_")) return null;
  const googleSub = userId.slice("google_".length);
  return googleSub || null;
}

function syntheticUser(googleSub: string, id: string) {
  return {
    id,
    googleSub,
    displayName: "Google user",
    camp: null,
    role: "user",
    stateJson: "{}",
    created: 0,
  };
}

export async function getUserFromRequest(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;

  const userId = await verifyToken(token);
  if (!userId) return null;

  const googleSubFromToken = googleSubFromUserId(userId);

  try {
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (user) return user;

    if (googleSubFromToken) {
      const [bySub] = await db
        .select()
        .from(users)
        .where(eq(users.googleSub, googleSubFromToken))
        .limit(1);
      if (bySub) return bySub;
    }

    if (googleSubFromToken) {
      return syntheticUser(googleSubFromToken, userId);
    }

    return null;
  } catch {
    if (googleSubFromToken) {
      return syntheticUser(googleSubFromToken, userId);
    }
    return null;
  }
}

export function isBootstrapAdmin(googleSub: string): boolean {
  return adminGoogleSubs().has(googleSub);
}
