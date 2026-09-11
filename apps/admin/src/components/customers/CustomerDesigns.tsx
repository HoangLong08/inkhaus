import { ImageOff, Palette, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { adminApi, ApiError } from "@/lib/api";
import { on } from "@/lib/format";

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3";

/**
 * Designs saved under the customer's address, drawn only for a viewer with
 * `designs.view` - the page decides that and never renders this otherwise, so
 * for staff there is no tab, no request and nothing in the payload.
 *
 * Its own async component, streamed behind a Suspense boundary: the endpoint
 * sends every design's scene and previews, which can take a while, and the rest
 * of the profile should not wait for it. A failure stays inside the tab rather
 * than replacing the whole profile with the segment error.
 */
export default async function CustomerDesigns({ email }: { email: string }) {
  const designs = await adminApi.customers.designs(email).catch((err: unknown) => {
    if (err instanceof ApiError) return null;
    throw err;
  });

  if (designs === null) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>Could not load this customer&apos;s designs</AlertTitle>
        <AlertDescription>Reload the page to try again.</AlertDescription>
      </Alert>
    );
  }

  if (designs.length === 0) {
    return (
      <Card>
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Palette />
            </EmptyMedia>
            <EmptyTitle>No saved designs</EmptyTitle>
            <EmptyDescription>Nothing has been saved from the studio under this address.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    );
  }

  return (
    <ul className={GRID}>
      {designs.map((design) => (
        <li key={design.publicId}>
          <Card className="gap-0 overflow-hidden p-0" data-testid="customer-design" data-design={design.publicId}>
            {design.hasFront ? (
              // eslint-disable-next-line @next/next/no-img-element -- same-origin BFF image; this app runs no image optimizer
              <img
                src={`/api/admin/designs/${encodeURIComponent(design.publicId)}/preview/front`}
                alt={`${design.name}, front`}
                loading="lazy"
                className="bg-muted aspect-square w-full object-contain"
              />
            ) : (
              <div className="bg-muted text-muted-foreground flex aspect-square w-full flex-col items-center justify-center gap-1 text-xs">
                <ImageOff className="size-5" />
                No preview
              </div>
            )}
            <CardContent className="space-y-0.5 border-t px-3 py-2">
              <p className="truncate text-sm font-medium">{design.name}</p>
              <p className="text-muted-foreground truncate font-mono text-xs">{design.productSlug}</p>
              <p className="text-muted-foreground text-xs">Saved {on(design.createdAt)}</p>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function CustomerDesignsSkeleton() {
  return (
    <div className={GRID}>
      {Array.from({ length: 3 }, (_, i) => (
        <Card key={i} className="gap-0 overflow-hidden p-0">
          <Skeleton className="aspect-square w-full rounded-none" />
          <CardContent className="space-y-1.5 border-t px-3 py-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
