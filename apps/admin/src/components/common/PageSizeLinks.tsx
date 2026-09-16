import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PAGE_SIZES } from "@/lib/schemas/params";
import { hrefWith, type Params } from "@/lib/url";

/**
 * Rows per page, as links. The sizes are the ones `limitParam` accepts - a size
 * offered here that the schema did not know would silently fall back to 20.
 * Changing size drops `page`: row 41 is not on page 3 any more.
 */
export default function PageSizeLinks({
  base,
  params = {},
  active,
  sizes = PAGE_SIZES,
  param = "limit",
  hideLabel = false,
}: {
  base: string;
  params?: Params;
  active: number;
  sizes?: readonly number[];
  param?: string;
  /** the caller already prints "Rows" beside it - `ListFooter` does */
  hideLabel?: boolean;
}) {
  return (
    <nav aria-label="Rows per page" className="flex items-center gap-1">
      {hideLabel ? null : (
        <span aria-hidden className="text-muted-foreground mr-1 text-xs">
          Rows
        </span>
      )}
      {sizes.map((size) => {
        const isActive = size === active;
        return (
          <Button
            key={size}
            asChild
            size="sm"
            variant={isActive ? "secondary" : "ghost"}
            className="h-7 px-2 text-xs tabular-nums"
          >
            <Link
              href={hrefWith(base, params, { [param]: size })}
              aria-current={isActive ? "page" : undefined}
              data-testid="page-size"
              data-limit={size}
            >
              {size}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
