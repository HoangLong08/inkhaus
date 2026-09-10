import { cn } from "cn";

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
            <Skeleton className="h-5 w-24 rounded-full" />
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
            <Skeleton className="h-5 w-20 rounded-full" />
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
  /** the placeholder bar; `h-5 w-24 rounded-full` for a status badge */
  bar?: string;
};

/**
 * Any list page's table. Pass the real page's columns - headings, alignment,
 * roughly how wide each value runs - and the skeleton lines up with it.
 */
export function TableSkeleton({
  columns,
  rows = 10,
}: {
  columns: readonly SkeletonColumn[];
  rows?: number;
}) {
  return (
    <Card className="overflow-hidden p-0">
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
    </Card>
  );
}

const ORDER_COLUMNS: SkeletonColumn[] = [
  { label: "Order", bar: "h-4 w-28" },
  { label: "Status", bar: "h-5 w-24 rounded-full" },
  { label: "Customer", bar: "h-4 w-40" },
  { label: "Units", align: "right", bar: "h-4 w-8" },
  { label: "Total", align: "right", bar: "h-4 w-16" },
  { label: "Placed", align: "right", bar: "h-4 w-20" },
];

export function OrdersTableSkeleton({ rows = 10 }: { rows?: number }) {
  return <TableSkeleton columns={ORDER_COLUMNS} rows={rows} />;
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

export function QuoteListSkeleton({ cards = 5 }: { cards?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: cards }, (_, i) => (
        <Card key={i} className="gap-3">
          <CardHeader>
            <Skeleton className="h-5 w-56" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-8 w-64" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** heading + meta line + a row of filter chips, shared by every list page's loading.tsx */
export function ListHeaderSkeleton({ chips = 6 }: { chips?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-48" />
      </div>
      {chips > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: chips }, (_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
