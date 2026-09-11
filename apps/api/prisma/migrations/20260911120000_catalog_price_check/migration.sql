-- The bulk price is the floor every volume discount stops at, so it can never
-- be above the single-unit price. AdminCatalogService checks it before writing
-- and writes only while the row is as it read it; this is the backstop for any
-- write that gets past both - a script, a seed, a future endpoint. A violation
-- surfaces as a 400 through PrismaExceptionFilter.
ALTER TABLE "products" ADD CONSTRAINT "products_bulk_le_price" CHECK ("bulkPrice" <= "price");
