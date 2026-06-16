import type { ModeId } from "@/src/core/types";
import { puzzleNumber } from "@/src/core/daily";
import {
  chapterFromMapPuzzle,
  getDailyScheduleRow,
  getMapById,
  getMapPuzzleById,
  listContentNpcs,
  listContentQuotes,
} from "../../../db/cms";

const MODES = new Set<ModeId>(["classic", "quote", "map", "card"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") as ModeId | null;
  const puzzleParam = url.searchParams.get("puzzle");
  const puzzle = puzzleParam === null ? puzzleNumber() : Number(puzzleParam);

  if (!mode || !MODES.has(mode) || !Number.isInteger(puzzle) || puzzle < 0) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const schedule = await getDailyScheduleRow(puzzle, mode);
  if (!schedule) {
    return Response.json({ error: "not_scheduled", puzzle, mode }, { status: 404 });
  }

  if (mode === "classic") {
    const npcId = schedule.npcId;
    if (!npcId) return Response.json({ error: "invalid_schedule" }, { status: 500 });
    const npcs = await listContentNpcs(true);
    const npc = npcs.find((entry) => entry.id === npcId);
    if (!npc) return Response.json({ error: "npc_not_found" }, { status: 404 });
    return Response.json({ mode, puzzle, npc });
  }

  if (mode === "card") {
    const npcId = schedule.npcId;
    if (!npcId) return Response.json({ error: "invalid_schedule" }, { status: 500 });
    const npcs = await listContentNpcs(true);
    const npc = npcs.find((entry) => entry.id === npcId);
    if (!npc) return Response.json({ error: "npc_not_found" }, { status: 404 });
    return Response.json({ mode, puzzle, npc });
  }

  if (mode === "quote") {
    const quoteId = schedule.quoteId;
    if (!quoteId) return Response.json({ error: "invalid_schedule" }, { status: 500 });
    const quotes = await listContentQuotes(true);
    const quote = quotes.find((entry) => entry.id === quoteId);
    if (!quote) return Response.json({ error: "quote_not_found" }, { status: 404 });
    return Response.json({ mode, puzzle, quote });
  }

  const mapPuzzleId = schedule.mapPuzzleId;
  if (!mapPuzzleId) return Response.json({ error: "invalid_schedule" }, { status: 500 });

  const mapPuzzle = await getMapPuzzleById(mapPuzzleId);
  if (!mapPuzzle) return Response.json({ error: "map_puzzle_not_found" }, { status: 404 });

  const map = await getMapById(mapPuzzle.mapId);
  if (!map) return Response.json({ error: "map_not_found" }, { status: 404 });

  const npcs = await listContentNpcs(true);
  const npc = npcs.find((entry) => entry.id === mapPuzzle.npcId);
  if (!npc) return Response.json({ error: "npc_not_found" }, { status: 404 });

  const toleranceMeters = mapPuzzle.toleranceMeters ?? map.defaultToleranceMeters;

  return Response.json({
    mode: "map",
    puzzle,
    npcId: npc.id,
    npcName: npc.names,
    chapter: chapterFromMapPuzzle(mapPuzzle),
    map: {
      id: map.id,
      imageUrl: map.imageUrl,
      imageWidth: map.imageWidth,
      imageHeight: map.imageHeight,
      metersPerPixel: map.metersPerPixel,
    },
    toleranceMeters,
  });
}
