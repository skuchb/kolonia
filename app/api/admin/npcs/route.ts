import { auditLog, requireAdmin } from "../../../../db/admin";
import { setNpcEnabled } from "../../../../db/cms-write";
import { parseNpcJson } from "../../../../db/cms";
import { listAdminSnapshot } from "../../../../db/cms-write";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").toLowerCase();
  const snapshot = await listAdminSnapshot();
  const npcs = snapshot.npcs
    .map((row) => ({ ...parseNpcJson(row.dataJson), enabled: row.enabled === 1, adminNote: row.adminNote }))
    .filter((npc) => {
      if (!q) return true;
      const aliases = (npc.aliases ?? []).join(" ").toLowerCase();
      return (
        npc.id.toLowerCase().includes(q) ||
        npc.name.toLowerCase().includes(q) ||
        npc.names.pl.toLowerCase().includes(q) ||
        npc.names.en.toLowerCase().includes(q) ||
        npc.names.de.toLowerCase().includes(q) ||
        aliases.includes(q)
      );
    });
  return Response.json({ npcs });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  let body: { id?: string; enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!body.id || typeof body.enabled !== "boolean") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  await setNpcEnabled(body.id, body.enabled);
  await auditLog(auth.user.id, "set_npc_enabled", "content_npc", body.id, body);
  return Response.json({ ok: true });
}
