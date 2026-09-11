import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function SectionSkeleton({ fields }: { fields: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-3 w-24" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** the product page's heading and ProductForm's two columns, so the swap is a fade */
export default function ProductFormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <SectionSkeleton fields={4} />
          <SectionSkeleton fields={1} />
          <SectionSkeleton fields={1} />
        </div>
        <div className="space-y-6">
          <SectionSkeleton fields={2} />
          <SectionSkeleton fields={2} />
        </div>
      </div>
    </div>
  );
}
