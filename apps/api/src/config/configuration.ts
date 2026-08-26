import { FREE_SHIPPING_OVER, SHIPPING_FLAT } from '@inkhaus/shared';

export default () => ({
  port: Number(process.env.PORT ?? 4000),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  databaseUrl: process.env.DATABASE_URL,
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:4321').split(',').map((o) => o.trim()),
  /// shared secret for the write/admin endpoints - set it in .env, there is no default in prod
  adminKey: process.env.ADMIN_API_KEY ?? '',
  order: {
    /// flat shipping until a real carrier is wired in
    shippingFlat: Number(process.env.SHIPPING_FLAT ?? SHIPPING_FLAT),
    /// orders at or over this ship free - same number the storefront advertises
    freeShippingOver: Number(process.env.FREE_SHIPPING_OVER ?? FREE_SHIPPING_OVER),
    taxRate: Number(process.env.TAX_RATE ?? 0),
  },
});
