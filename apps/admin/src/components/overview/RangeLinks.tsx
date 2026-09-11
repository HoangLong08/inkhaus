import { STATS_RANGES, type StatsRange } from "@inkhaus/shared/admin";

import FilterLinks from "@/components/common/FilterLinks";
import type { OverviewQuery } from "@/lib/schemas/params";

const LABEL: Record<StatsRange, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "365d": "365 days",
};

/**
 * The range switch. Links, like every filter here: a range is a URL someone can
 * be sent, and the current one carries `aria-current`. FilterLinks mirrors the
 * value onto `data-range`; there is no "All" link, because every choice is a
 * range.
 */
export default function RangeLinks({ params }: { params: OverviewQuery }) {
  return (
    <FilterLinks
      base="/"
      param="range"
      values={STATS_RANGES}
      active={params.range}
      params={params}
      testId="range-link"
      ariaLabel="Date range"
      allLabel={null}
      label={(value) => LABEL[value as StatsRange]}
    />
  );
}
