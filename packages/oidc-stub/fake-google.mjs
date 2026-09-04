/**
 * A minimal OIDC provider that stands in for Google during e2e.
 *
 * Why this exists: Google actively blocks automated browsers, and there is no
 * way at all to test the cases that matter most - a valid Google account that
 * is NOT on the back office allowlist being refused, an unverified address
 * being refused everywhere - with a real account. So the browser stays real,
 * the redirects stay real, the id_token stays a real signed JWT verified
 * against a real JWKS endpoint; only the issuer is local.
 *
 * It speaks just enough of the spec for our flow:
 *   GET  /.well-known/jwks.json   public keys, fetched by the API
 *   GET  /o/oauth2/v2/auth        a consent screen with one button per account
 *   POST /token                   code -> id_token
 *
 * It lives in packages/ rather than in either app's e2e folder because both
 * suites drive it now - the storefront and the back office sign in through the
 * same Google client, and testing them against two different stubs would be
 * testing something the production system does not do.
 *
 * Run standalone with:  npm start -w @inkhaus/oidc-stub
 */
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const PORT = Number(process.env.FAKE_GOOGLE_PORT ?? 4399);
const ISSUER = process.env.FAKE_GOOGLE_ISSUER ?? `http://localhost:${PORT}`;
const AUDIENCE = process.env.FAKE_GOOGLE_CLIENT_ID ?? "inkhaus-e2e-client";
/** what the consent screen says it is signing you in to */
const APP_NAME = process.env.FAKE_GOOGLE_APP_NAME ?? "INKHAUS";

/**
 * The accounts the consent screen offers, and what each one is for:
 *
 *   owner      seeded OWNER; a shopper too, since customers are not an allowlist
 *   staff      seeded STAFF
 *   outsider   a real Google account with no admin row - refused by the back
 *              office, welcomed by the storefront as a brand new customer
 *   unverified a Workspace-style account that never proved its address; refused
 *              by both, even though the token itself is perfectly valid
 */
export const ACCOUNTS = [
  { key: "owner", email: "hoangnguyenitvn@gmail.com", name: "Hoang Nguyen", verified: true },
  { key: "staff", email: "e2e-staff@inkhaus.test", name: "E2E Staff", verified: true },
  { key: "outsider", email: "not-on-the-list@gmail.com", name: "Random Person", verified: true },
  { key: "unverified", email: "longnguyen.080400@gmail.com", name: "Unverified", verified: false },
  // the address apps/api/prisma/seed-e2e.ts files storefront orders under, so
  // the account page has a history to show on the very first sign-in
  { key: "shopper", email: "e2e-shopper@inkhaus.test", name: "E2E Shopper", verified: true },
];

/** a 1x1 transparent gif, so an avatar renders without leaving localhost */
const AVATAR =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
const jwk = { ...(await exportJWK(publicKey)), kid: "fake-google-1", alg: "RS256", use: "sig" };

/** one-time authorization codes, code -> account */
const codes = new Map();

function html(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Sign in - Google (fake)</title>
<style>body{font-family:system-ui;margin:0;display:grid;place-items:center;min-height:100vh;background:#f6f7f9}
main{background:#fff;border:1px solid #dadce0;border-radius:8px;padding:32px;min-width:360px}
h1{font-size:20px;margin:0 0 4px}p{color:#5f6368;font-size:13px;margin:0 0 20px}
button{display:block;width:100%;text-align:left;padding:12px;margin:6px 0;border:1px solid #dadce0;
border-radius:6px;background:#fff;cursor:pointer;font-size:14px}button:hover{background:#f1f3f4}
small{color:#5f6368}</style></head><body><main>${body}</main></body></html>`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/.well-known/jwks.json") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ keys: [jwk] }));
  }

  // The consent screen. Each button is a plain link carrying a fresh code, so
  // Playwright drives it the same way a person would.
  if (url.pathname === "/o/oauth2/v2/auth") {
    const redirectUri = url.searchParams.get("redirect_uri");
    const state = url.searchParams.get("state");
    if (!redirectUri || !state) {
      res.writeHead(400, { "content-type": "text/plain" });
      return res.end("missing redirect_uri or state");
    }

    const buttons = ACCOUNTS.map((acct) => {
      const code = randomBytes(16).toString("hex");
      codes.set(code, acct);
      const back = new URL(redirectUri);
      back.searchParams.set("code", code);
      back.searchParams.set("state", state);
      return `<button type="button" data-testid="pick-${acct.key}"
        onclick="location.href='${back.toString().replace(/'/g, "&#39;")}'">
        <strong>${acct.name}</strong><br><small>${acct.email}${
          acct.verified ? "" : " (unverified)"
        }</small></button>`;
    }).join("");

    // "cancel" exercises the error branch of the callback
    const cancel = new URL(redirectUri);
    cancel.searchParams.set("error", "access_denied");
    cancel.searchParams.set("state", state);

    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(
      html(
        `<h1>Choose an account</h1><p>to continue to ${APP_NAME}</p>${buttons}
         <button type="button" data-testid="pick-cancel"
           onclick="location.href='${cancel.toString().replace(/'/g, "&#39;")}'">Cancel</button>`,
      ),
    );
  }

  if (url.pathname === "/token" && req.method === "POST") {
    const body = await new Promise((resolve) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => resolve(new URLSearchParams(raw)));
    });

    const account = codes.get(body.get("code") ?? "");
    // codes are single use, exactly as at Google
    codes.delete(body.get("code") ?? "");

    if (!account) {
      res.writeHead(400, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: "invalid_grant" }));
    }

    const idToken = await new SignJWT({
      email: account.email,
      email_verified: account.verified,
      name: account.name,
      // Google sends one; the storefront header renders it as the avatar. A
      // data: URI keeps the test offline - a lh3.googleusercontent.com URL
      // would be a real network fetch from the browser under test.
      picture: AVATAR,
    })
      .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      // a stable per-account subject, like Google's `sub`
      .setSubject(`fake-sub-${account.key}`)
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(privateKey);

    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ id_token: idToken, token_type: "Bearer", expires_in: 600 }));
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`fake-google listening on ${ISSUER}`);
});
