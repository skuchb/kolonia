import { requireAdmin } from "../../../../db/admin";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  return Response.json({ ok: true, userId: auth.user.id, role: auth.user.role });
}
