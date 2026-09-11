import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OverviewQuery } from "@/lib/schemas/params";

import { getOverview } from "./data";
import { dayRange } from "./labels";
import RevenueChart from "./RevenueChart";
import SeriesTable from "./SeriesTable";

/**
 * The daily series twice over: drawn for the eye by RevenueChart, a client
 * component because the chart has to measure itself in a browser, and set out
 * as a table for a screen reader by SeriesTable, which stays on the server.
 */
export default async function RevenueTrend({ params }: { params: OverviewQuery }) {
  const { series, range } = await getOverview(params);
  if (!series || !range) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>Revenue per day</h3>
        </CardTitle>
        <CardDescription>
          Paid orders, by the UTC day they were placed. Cancelled, refunded and unpaid orders are
          left out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RevenueChart series={series} />
        <SeriesTable
          series={series}
          caption={`Revenue and paid orders per day, ${dayRange(range.from, range.to)}, UTC`}
        />
      </CardContent>
    </Card>
  );
}
