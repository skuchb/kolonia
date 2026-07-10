import { readVapidConfig } from "../../../../db/push";

export async function GET() {
  const config = readVapidConfig();
  if (!config) {
    return Response.json({ error: "push_not_configured" }, { status: 503 });
  }

  return Response.json({ publicKey: config.publicKey });
}
