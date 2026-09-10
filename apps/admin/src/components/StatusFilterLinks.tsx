import FilterLinks from "@/components/common/FilterLinks";
import type { Params } from "@/lib/url";

/**
 * The status chip row on /orders and /quotes - `FilterLinks` with the
 * `status-filter` test id and `data-status` its tests were written against.
 *
 * Pass the page's parsed params: a chip keeps the search and every other
 * filter, and drops `page`. It used to link to `?status=X` alone, which threw
 * away whatever had been typed into the search box.
 */
export default function StatusFilterLinks({
  base,
  statuses,
  active,
  params,
}: {
  base: string;
  statuses: readonly string[];
  active?: string;
  params?: Params;
}) {
  return (
    <FilterLinks
      base={base}
      param="status"
      values={statuses}
      active={active}
      params={params}
      testId="status-filter"
      ariaLabel="Filter by status"
    />
  );
}
