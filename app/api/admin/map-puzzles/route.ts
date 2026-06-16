import { auditLog, requireAdmin } from "../../../../db/admin";
import { upsertMapPuzzle } from "../../../../db/cms-write";
import { listAdminSnapshot } from "../../../../db/cms-write";
import { parseNpcJson } from "../../../../db/cms";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const snapshot = await listAdminSnapshot();
  const npcNameById = new Map(
    snapshot.npcs.map((row) => {
      const npc = parseNpcJson(row.dataJson);
      return [npc.id, npc.names.pl] as const;
    }),
  );
  const puzzles = snapshot.mapPuzzles.map((row) => ({
    ...row,
    npcName: npcNameById.get(row.npcId) ?? row.npcId,
  }));
  return Response.json({ maps: snapshot.maps, puzzles });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  let body: {
    id?: number;
    mapId: string;
    npcId: string;
    x: number;
    y: number;
    toleranceMeters?: number | null;
    chapterPl?: string | null;
    chapterEn?: string | null;
    chapterDe?: string | null;
    label?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!body.mapId || !body.npcId || typeof body.x !== "number" || typeof body.y !== "number") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const id = await upsertMapPuzzle(body);
  await auditLog(auth.user.id, "upsert_map_puzzle", "map_puzzle", String(id), body);
  return Response.json({ ok: true, id });
}
