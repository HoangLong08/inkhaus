import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { count, on, usd } from "@/lib/format";
import type { StatsSeriesPoint } from "@/lib/schemas/api";

/**
 * The chart's text equivalent: the same series, one row per day, visually
 * hidden. RevenueChart is hidden from assistive technology, so this is what a
 * screen reader gets instead - every value, not a tooltip it cannot hover.
 */
export default function SeriesTable({
  series,
  caption,
}: {
  series: StatsSeriesPoint[];
  caption: string;
}) {
  return (
    <div className="sr-only">
      <Table data-testid="series-table">
        <TableCaption>{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Day</TableHead>
            <TableHead scope="col">Paid orders</TableHead>
            <TableHead scope="col">Revenue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {series.map((point) => (
            <TableRow key={point.date} data-date={point.date}>
              <TableHead scope="row">{on(point.date)}</TableHead>
              <TableCell>{count(point.orders)}</TableCell>
              <TableCell>{usd(point.revenue)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
