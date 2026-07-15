import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../db/admin";
import { sendDailyPuzzlePushes } from "../../../../db/push";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  if (!env.DB) {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }

  const result = await sendDailyPuzzlePushes(env.DB, { force: true });
  return Response.json(result);
}
