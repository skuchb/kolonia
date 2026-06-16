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

export async function getUserFromRequest(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;

  const userId = await verifyToken(token);
  if (!userId) return null;

  try {
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user ?? null;
  } catch {
    return null;
  }
}

export async function requireAdmin(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return { error: Response.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const bootstrapAdmins = adminGoogleSubs();
  const isAdmin = user.role === "admin" || bootstrapAdmins.has(user.googleSub);
  if (!isAdmin) {
    return { error: Response.json({ error: "forbidden" }, { status: 403 }) };
  }

  return { user };
}

export async function auditLog(
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  details?: unknown,
) {
  try {
    const db = getDb();
    const { adminAuditLog } = await import("./schema");
    await db.insert(adminAuditLog).values({
      userId,
      action,
      entityType,
      entityId: entityId ?? null,
      detailsJson: details ? JSON.stringify(details) : null,
      ts: Date.now(),
    });
  } catch {
    // optional
  }
}
