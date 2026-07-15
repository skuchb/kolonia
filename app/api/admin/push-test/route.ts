import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../db/admin";
import { listPushSubscriptionsForAdmin, sendDailyPuzzlePushes } from "../../../../db/push";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  if (!env.DB) {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }

  const subscriptions = await listPushSubscriptionsForAdmin(env.DB);
  return Response.json({ count: subscriptions.length, subscriptions });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  if (!env.DB) {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }

  const result = await sendDailyPuzzlePushes(env.DB, { force: true });
  return Response.json(result);
}
