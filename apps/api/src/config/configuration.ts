import { FREE_SHIPPING_OVER, SHIPPING_FLAT } from '@inkhaus/shared';

const GOOGLE_ISSUER = 'https://accounts.google.com';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

/**
 * The e2e suite swaps Google for a local OIDC stub, which means the issuer and
 * key set have to be overridable. That is a loaded gun: an environment variable
 * pointing at an attacker's issuer would make every forged token valid. So the
 * overrides are refused outright in production rather than merely discouraged -
 * the check lives here, at the single place config is read, not at each use.
 */
const isProd = process.env.NODE_ENV === 'production';
const devOnly = (value: string | undefined, fallback: string) =>
  !isProd && value ? value : fallback;

export default () => ({
  /// API_PORT, not PORT: the root .env is shared with two Next apps, and a bare
  /// PORT there would send one of them at 4000. A platform-injected PORT still
  /// works as the fallback.
  port: Number(process.env.API_PORT ?? process.env.PORT ?? 4000),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  databaseUrl: process.env.DATABASE_URL,
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:4321').split(',').map((o) => o.trim()),
  /// how long an admin session token stays valid before a fresh sign-in
  adminSessionTtlHours: Number(process.env.ADMIN_SESSION_TTL_HOURS ?? 12),
  /// Storefront sessions, in days rather than hours. A shopper coming back to
  /// check an order next week should still be signed in; a session that can see
  /// every order in the system should not be. Different blast radius, different
  /// number.
  customerSessionTtlDays: Number(process.env.CUSTOMER_SESSION_TTL_DAYS ?? 30),
  google: {
    /// the `aud` every admin id_token must carry - same client as apps/admin uses
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    issuer: devOnly(process.env.GOOGLE_ISSUER, GOOGLE_ISSUER),
    jwksUrl: devOnly(process.env.GOOGLE_JWKS_URL, GOOGLE_JWKS_URL),
  },
  order: {
    /// flat shipping until a real carrier is wired in
    shippingFlat: Number(process.env.SHIPPING_FLAT ?? SHIPPING_FLAT),
    /// orders at or over this ship free - same number the storefront advertises
    freeShippingOver: Number(process.env.FREE_SHIPPING_OVER ?? FREE_SHIPPING_OVER),
    taxRate: Number(process.env.TAX_RATE ?? 0),
  },
  /// Price edits in the back office (decision D13) - price, bulk price, size
  /// upcharges, tiers, and creating a product. Off until the storefront reads
  /// prices from the API: until then it shows prices from packages/shared while
  /// checkout charges the database, and an edit would make the two disagree.
  /// Only the exact string "true" turns it on. See PriceEditsPolicy.
  catalogPriceEdits: process.env.CATALOG_PRICE_EDITS === 'true',
});
