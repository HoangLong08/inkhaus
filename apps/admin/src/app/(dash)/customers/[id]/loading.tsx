import { TableSkeleton } from "@/components/skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** the profile's shape - heading, six tiles, the tabbed orders table and the profile card */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i} className="gap-1 py-4">
            <CardHeader className="gap-2 px-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-16" />
            </CardHeader>
            <CardContent className="px-4">
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 rounded-lg" />
          <TableSkeleton
            rows={3}
            columns={[
              { label: "Order", bar: "h-4 w-28" },
              { label: "Status", bar: "h-5 w-24 rounded-full" },
              { label: "Units", align: "right", bar: "h-4 w-8" },
              { label: "Total", align: "right", bar: "h-4 w-16" },
              { label: "Placed", align: "right", bar: "h-4 w-20" },
            ]}
          />
        </div>
        <Card className="h-80" />
      </div>
    </div>
  );
}
