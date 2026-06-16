import { googleOAuthConfig, oauthCookie } from "../../../../../db/auth";

export async function GET(request: Request) {
  const config = googleOAuthConfig(request);
  if (!config) {
    return Response.json({ error: "google_oauth_not_configured" }, { status: 503 });
  }

  const state = crypto.randomUUID();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Set-Cookie": oauthCookie(state, 600),
    },
  });
}
