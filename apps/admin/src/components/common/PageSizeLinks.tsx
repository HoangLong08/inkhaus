import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { PAGE_SIZES } from "@/lib/schemas/params";
import { hrefWith, type Params } from "@/lib/url";

/**
 * Rows per page, as links. The sizes are the ones `limitParam` accepts - a size
 * offered here that the schema did not know would silently fall back to 20.
 * Changing size drops `page`: row 41 is not on page 3 any more.
 *
 * A Server Component, reached only through `ListFooter`, so it reads the `List`
 * namespace with `getTranslations` and nothing here ships to the browser.
 */
export default async function PageSizeLinks({
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
  /** the caller already prints `List.rows.label` beside it - `ListFooter` does */
  hideLabel?: boolean;
}) {
  const t = await getTranslations("List");

  return (
    <nav aria-label={t("rows.aria")} className="flex items-center gap-1">
      {hideLabel ? null : (
        <span aria-hidden className="text-muted-foreground mr-1 text-xs">
          {t("rows.label")}
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
            // h-8, the shared control height: these sit in `ListFooter` beside
            // `Pager`'s `icon-sm` (32px) edge buttons, and h-7 next to them was
            // exactly the 4px step toolbar-styles.ts exists to kill.
            className="h-8 px-2 text-xs tabular-nums"
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
