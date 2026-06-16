import { getUserFromRequest, isBootstrapAdmin } from "./user-from-request";

export { getUserFromRequest } from "./user-from-request";

export async function requireAdmin(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return { error: Response.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const isAdmin = user.role === "admin" || isBootstrapAdmin(user.googleSub);
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
    const db = (await import("./index")).getDb();
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
