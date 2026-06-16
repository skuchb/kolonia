import { auditLog, requireAdmin } from "../../../../db/admin";
import { listAdminSnapshot } from "../../../../db/cms-write";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const snapshot = await listAdminSnapshot();
  return Response.json(snapshot);
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  await auditLog(auth.user.id, "refresh_snapshot", "cms", undefined, { ts: Date.now() });
  const snapshot = await listAdminSnapshot();
  return Response.json(snapshot);
}
