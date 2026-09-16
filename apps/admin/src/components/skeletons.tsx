import { cn } from "cn";

import TableCard from "@/components/common/TableCard";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Every skeleton here mirrors the real markup it stands in for - a real <Table>
 * with real column widths, a real card grid - so the swap when data lands is a
 * fade, not a reflow. A generic grey box would move every row on the page.
 */

export function StatTilesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <Card key={i} className="gap-2">
          <CardHeader className="pb-0">
            <Skeleton className="h-5 w-28 rounded-md" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-12" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function LatestOrdersSkeleton() {
  return (
    <Card className="p-0">
      <CardHeader className="border-b px-4 py-3">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <ul className="divide-y">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-24 rounded-md" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="ml-auto h-4 w-16" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export type SkeletonColumn = {
  /** the real column's heading, so the header row does not move either */
  label: string;
  align?: "left" | "right";
  /** the placeholder bar; `h-5 w-28 rounded-md` for a status badge */
  bar?: string;
};

/**
 * Any list page's table. Pass the real page's columns - headings, alignment,
 * roughly how wide each value runs - and the skeleton lines up with it.
 *
 * `dense` mirrors what the real page renders: a list built on `TableCard` has a
 * tinted 36px header, 36px rows and ruled cells. Leave it off and the skeleton is
 * the pre-TableCard layout, which is still what most lists render. Getting it
 * wrong costs a reflow at the moment the data lands, which is the one thing this
 * file exists to prevent.
 *
 * `fill` is the same flag the real `TableCard` takes, and a skeleton inside a
 * `ListPage` needs it for the same reason the page does: without it the
 * placeholder table is only as tall as its rows and the footer sits halfway up
 * the screen, then jumps to the bottom when the data lands.
 */
export function TableSkeleton({
  columns,
  rows = 10,
  dense = false,
  fill = false,
}: {
  columns: readonly SkeletonColumn[];
  rows?: number;
  /** the page wraps its table in `TableCard` */
  dense?: boolean;
  /** the page is a `ListPage`, so the card takes the height that is left */
  fill?: boolean;
}) {
  const table = (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.label}
              className={column.align === "right" ? "text-right" : undefined}
            >
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }, (_, i) => (
          <TableRow key={i}>
            {columns.map((column) => (
              <TableCell
                key={column.label}
                className={column.align === "right" ? "text-right" : undefined}
              >
                <Skeleton
                  className={cn(
                    column.bar ?? "h-4 w-24",
                    column.align === "right" && "ml-auto",
                  )}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return dense ? (
    <TableCard fill={fill}>{table}</TableCard>
  ) : (
    <PlainTableCard>{table}</PlainTableCard>
  );
}

/** the row under a dense list's table - see `ListFooter` */
export function ListFooterSkeleton() {
  return (
    <div className="flex w-full flex-col items-center justify-between gap-3 px-3 sm:flex-row sm:gap-4">
      <Skeleton className="h-4 w-44" />
      <div className="flex items-center gap-6">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-52" />
      </div>
    </div>
  );
}

/** what every table skeleton sat in before `TableCard` existed */
function PlainTableCard({ children }: { children: React.ReactNode }) {
  return <Card className="overflow-hidden p-0">{children}</Card>;
}

const ORDER_COLUMNS: SkeletonColumn[] = [
  { label: "Order", bar: "h-4 w-28" },
  { label: "Status", bar: "h-5 w-28 rounded-md" },
  { label: "Customer", bar: "h-4 w-40" },
  { label: "Units", align: "right", bar: "h-4 w-8" },
  { label: "Total", align: "right", bar: "h-4 w-16" },
  { label: "Placed", align: "right", bar: "h-4 w-20" },
];

export function OrdersTableSkeleton({ rows = 10 }: { rows?: number }) {
  // /orders is the list built on TableCard inside a ListPage; the others are
  // not yet
  return <TableSkeleton columns={ORDER_COLUMNS} rows={rows} dense fill />;
}

export function OrderDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="h-64" />
          <Card className="h-40" />
        </div>
        <div className="space-y-6">
          <Card className="h-56" />
          <Card className="h-36" />
        </div>
      </div>
    </div>
  );
}

/** heading + meta line + a row of filter chips, shared by every list page's loading.tsx */
export function ListHeaderSkeleton({ chips = 6 }: { chips?: number }) {
  return (
    // the geometry ListHeader actually renders: a text-xl heading, a text-xs
    // meta line, h-8 chips, and the gap-2 rhythm ListPage lays its children out
    // on. A skeleton a size off its own page is a layout jump on every load.
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-3.5 w-48" />
      </div>
      {chips > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: chips }, (_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
