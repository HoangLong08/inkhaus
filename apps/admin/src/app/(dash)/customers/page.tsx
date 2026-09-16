import { CUSTOMER_ORDER_FILTERS } from "@inkhaus/shared/admin";
import { SearchX } from "lucide-react";

import FilterLinks from "@/components/common/FilterLinks";
import ListEmpty from "@/components/common/ListEmpty";
import ListFooter from "@/components/common/ListFooter";
import ListHeader from "@/components/common/ListHeader";
import ListPage from "@/components/common/ListPage";
import UrlSearchBox from "@/components/common/UrlSearchBox";
import CustomersTable from "@/components/customers/CustomersTable";
import { adminApi } from "@/lib/api";
import { count } from "@/lib/format";
import { customersLinkParams, customersQuerySchema } from "@/lib/schemas/params";

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
  const linkParams = customersLinkParams(params);

  return (
    <ListPage>
      <ListHeader
        title="Customers"
        description="One row per address: everyone who has ordered, asked for a quote or saved a design."
        meta={`${count(meta.total)} total · page ${meta.page} of ${meta.pages}`}
        metaTestId="customers-meta"
      />

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="w-full sm:w-64">
          <UrlSearchBox
            label="Search customers"
            placeholder="Email, name, company or phone…"
            testId="customers-search"
            clearTestId="customers-search-clear"
          />
        </div>
        <FilterLinks
          base="/customers"
          param="hasOrders"
          values={CUSTOMER_ORDER_FILTERS}
          active={params.hasOrders}
          params={linkParams}
          ariaLabel="Filter customers by orders"
          label={(value) => ORDER_FILTER_LABEL[value] ?? value}
        />
      </div>

      {data.length === 0 ? (
        <ListEmpty
          icon={SearchX}
          title="No customers match"
          description="Try another part of their email or name, or clear the filter."
          reason="filtered"
        />
      ) : (
        <>
          <CustomersTable customers={data} params={params} />
          <ListFooter
            base="/customers"
            page={meta.page}
            pages={meta.pages}
            limit={params.limit}
            total={meta.total}
            shown={data.length}
            noun="customers"
            params={linkParams}
          />
        </>
      )}
    </ListPage>
  );
}
