import { z } from "zod";

import { adminRoleSchema } from "./core";

/**
 * Small reference lists more than one screen needs - who can be assigned a
 * quote, which blanks an order can be built from. They are not any one
 * feature's data, so they live here rather than in `staff.ts` or `catalog.ts`,
 * and every feature reads them through `adminApi.lookups`.
 *
 * FROZEN after Phase 0.
 */

/** `GET /admin/staff/directory` - active admins, for assignee pickers */
export const staffDirectoryEntrySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  role: adminRoleSchema,
});

export const staffDirectorySchema = z.array(staffDirectoryEntrySchema);

/**
 * `GET /admin/catalog/options` - active products with their prices, and the
 * live price ladder: everything the shared `quote()` needs to estimate.
 */
export const catalogOptionsSchema = z.object({
  products: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      /** single-unit list price, USD */
      price: z.number(),
      /** the floor no tier discount goes below, USD */
      bulkPrice: z.number(),
      methods: z.array(z.string()),
      sizes: z.array(z.string()),
      colors: z.array(z.object({ slug: z.string(), name: z.string(), hex: z.string() })),
    }),
  ),
  ladder: z.object({
    tiers: z.array(z.object({ min: z.number(), off: z.number() })),
    upcharges: z.record(z.string(), z.number()),
  }),
  priceEditsEnabled: z.boolean(),
});

export type StaffDirectoryEntry = z.infer<typeof staffDirectoryEntrySchema>;
export type CatalogOptions = z.infer<typeof catalogOptionsSchema>;
export type CatalogOptionsProduct = CatalogOptions["products"][number];
