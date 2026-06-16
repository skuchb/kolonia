import { puzzleNumber } from "@/src/core/daily";
import { getDailyScheduleRow, getMapById, getMapPuzzleById } from "../../../../../db/cms";

export async function POST(request: Request) {
  let body: { puzzle?: number; x?: number; y?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const puzzle = body.puzzle ?? puzzleNumber();
  const x = body.x;
  const y = body.y;
  if (!Number.isInteger(puzzle) || puzzle < 0 || typeof x !== "number" || typeof y !== "number") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (x < 0 || x > 1 || y < 0 || y > 1) {
    return Response.json({ error: "invalid_coords" }, { status: 400 });
  }

  const schedule = await getDailyScheduleRow(puzzle, "map");
  if (!schedule?.mapPuzzleId) {
    return Response.json({ error: "not_scheduled" }, { status: 404 });
  }

  const mapPuzzle = await getMapPuzzleById(schedule.mapPuzzleId);
  if (!mapPuzzle) return Response.json({ error: "map_puzzle_not_found" }, { status: 404 });

  const map = await getMapById(mapPuzzle.mapId);
  if (!map) return Response.json({ error: "map_not_found" }, { status: 404 });

  const { mapDistanceMeters } = await import("@/src/modes/map/distance");
  const distanceMeters = mapDistanceMeters(
    x,
    y,
    mapPuzzle.x,
    mapPuzzle.y,
    map.imageWidth,
    map.imageHeight,
    map.metersPerPixel,
  );

  const toleranceMeters = mapPuzzle.toleranceMeters ?? map.defaultToleranceMeters;
  const solved = distanceMeters <= toleranceMeters;

  return Response.json({
    distanceMeters,
    solved,
    toleranceMeters,
  });
}
