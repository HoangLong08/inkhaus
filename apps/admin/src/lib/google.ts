import "server-only";

/**
 * The Google end of the sign-in flow. Deliberately hand-rolled rather than
 * pulling in an OAuth library: the whole dance is authorization-code + PKCE,
 * which is two requests and a hash, and a dependency here would be a
 * dependency in the path of every login.
 */

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

const isProd = process.env.NODE_ENV === "production";

/**
 * The e2e suite points these at a local OIDC stub so a real browser can walk the
 * real flow without Google. Ignored outright in production - an endpoint
 * override is a redirect to an attacker's consent screen.
 */
const devOnly = (value: string | undefined, fallback: string) =>
  !isProd && value ? value : fallback;

export const googleConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID ?? "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  authEndpoint: devOnly(process.env.GOOGLE_AUTH_ENDPOINT, GOOGLE_AUTH),
  tokenEndpoint: devOnly(process.env.GOOGLE_TOKEN_ENDPOINT, GOOGLE_TOKEN),
  /** must match a redirect URI registered on the OAuth client, exactly */
  redirectUri: `${(process.env.ADMIN_PUBLIC_URL ?? "http://localhost:4322").replace(/\/$/, "")}/auth/google/callback`,
};

export function isGoogleConfigured() {
  return Boolean(googleConfig.clientId && googleConfig.clientSecret);
}

/** base64url of the sha256 of the verifier - PKCE S256 */
export async function codeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return Buffer.from(digest).toString("base64url");
}

export function authorizeUrl(state: string, challenge: string) {
  const url = new URL(googleConfig.authEndpoint);
  url.search = new URLSearchParams({
    client_id: googleConfig.clientId,
    redirect_uri: googleConfig.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    // staff often have several Google accounts open; without this the browser
    // silently picks the first one and the refusal looks like a bug
    prompt: "select_account",
  }).toString();
  return url.toString();
}

/** Swaps the one-time code for an id_token. Never runs anywhere but the server. */
export async function exchangeCode(code: string, verifier: string) {
  const res = await fetch(googleConfig.tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: googleConfig.clientId,
      client_secret: googleConfig.clientSecret,
      redirect_uri: googleConfig.redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) throw new Error("Google token response carried no id_token");
  return body.id_token;
}
