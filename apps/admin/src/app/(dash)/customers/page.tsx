import { CUSTOMER_ORDER_FILTERS } from "@inkhaus/shared/admin";
import { SearchX } from "lucide-react";

import FilterLinks from "@/components/common/FilterLinks";
import ListHeader from "@/components/common/ListHeader";
import UrlSearchBox from "@/components/common/UrlSearchBox";
import CustomersTable from "@/components/customers/CustomersTable";
import Pager from "@/components/Pager";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { adminApi } from "@/lib/api";
import { count } from "@/lib/format";
import { customersQuerySchema } from "@/lib/schemas/params";

export const metadata = { title: "Customers — INKHAUS Back Office" };

const ORDER_FILTER_LABEL: Record<string, string> = { yes: "With orders", no: "No orders" };

/**
 * Everyone who has ordered, asked for a quote or saved a design - one row per
 * address. Fully server rendered: the table is a pure projection of the URL, and
 * the only client component is the search box, which navigates rather than
 * fetches.
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Every field ends in .catch(), so this cannot throw: an unknown ?sort= or
  // ?hasOrders= is dropped rather than passed to the API.
  const params = customersQuerySchema.parse(await searchParams);
  const { data, meta } = await adminApi.customers.list(params);

  return (
    <div className="space-y-6">
      <ListHeader
        title="Customers"
        meta={`${count(meta.total)} total · page ${meta.page} of ${meta.pages}`}
        metaTestId="customers-meta"
      />

      <UrlSearchBox
        label="Search customers"
        placeholder="Email, name, company or phone…"
        testId="customers-search"
        clearTestId="customers-search-clear"
      />

      <FilterLinks
        base="/customers"
        param="hasOrders"
        values={CUSTOMER_ORDER_FILTERS}
        active={params.hasOrders}
        params={params}
        ariaLabel="Filter customers by orders"
        label={(value) => ORDER_FILTER_LABEL[value] ?? value}
      />

      {data.length === 0 ? (
        <Card>
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>No customers match</EmptyTitle>
              <EmptyDescription>Try another part of their email or name, or clear the filter.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      ) : (
        <CustomersTable customers={data} params={params} />
      )}

      <Pager base="/customers" page={meta.page} pages={meta.pages} params={params} />
    </div>
  );
}
