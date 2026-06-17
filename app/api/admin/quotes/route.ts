import { auditLog, requireAdmin } from "../../../../db/admin";
import { setQuoteEnabled } from "../../../../db/cms-write";
import { parseQuoteJson } from "../../../../db/cms";
import { listAdminSnapshot } from "../../../../db/cms-write";
import { getNpcById } from "@/src/data";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").toLowerCase();
  const npcId = url.searchParams.get("npcId");
  const snapshot = await listAdminSnapshot();

  const quotes = snapshot.quotes
    .map((row) => ({
      ...parseQuoteJson(row.dataJson),
      enabled: row.enabled === 1,
      qualityStatus: row.qualityStatus,
      adminNote: row.adminNote,
    }))
    .filter((quote) => {
      if (npcId && quote.npcId !== npcId) return false;
      if (!q) return true;
      const npc = getNpcById(quote.npcId);
      const text = [
        quote.id,
        quote.npcId,
        npc?.names.pl,
        npc?.names.en,
        npc?.names.de,
        quote.lines.map((line) => [line.text.pl, line.text.en, line.text.de].join(" ")).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });

  return Response.json({ quotes });
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

  try {
    await setQuoteEnabled(body.id, body.enabled);
    await auditLog(auth.user.id, "set_quote_enabled", "content_quote", body.id, body);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "cms_write_failed";
    return Response.json({ error: message }, { status: 503 });
  }
}
