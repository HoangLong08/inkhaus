import { can } from "@inkhaus/shared/admin";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import PriceSyncWarning from "@/components/catalog/PriceSyncWarning";
import ProductForm from "@/components/catalog/ProductForm";
import OwnersOnly from "@/components/common/OwnersOnly";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";

export const metadata = { title: "New product — INKHAUS Back Office" };

/**
 * A new blank. Owners only (D12) - it carries a price - and only while price
 * edits are on (D13); otherwise the page says why instead of offering a form
 * whose save would be refused.
 */
export default async function NewProductPage() {
  const user = await requireAdmin();
  if (!can(user.role, "catalog.create")) {
    return (
      <OwnersOnly title="New product">
        A new blank carries a price, so adding one is limited to owners. Ask an owner to add it.
      </OwnersOnly>
    );
  }

  const [options, sizes, colors] = await Promise.all([
    adminApi.lookups.catalogOptions(),
    adminApi.catalog.sizes(),
    adminApi.catalog.colors(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link href="/catalog" data-testid="product-back">
            <ArrowLeft />
            Products
          </Link>
        </Button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">New product</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          It starts archived, so the storefront does not list it until it is switched on.
        </p>
      </div>

      {options.priceEditsEnabled ? (
        <ProductForm
          mode="create"
          role={user.role}
          priceEditsEnabled={options.priceEditsEnabled}
          sizes={sizes}
          colors={colors}
        />
      ) : (
        <PriceSyncWarning />
      )}
    </div>
  );
}
