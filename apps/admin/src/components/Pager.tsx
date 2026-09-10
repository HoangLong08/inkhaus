import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";

import { buttonVariants } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import { hrefWith, type Params } from "@/lib/url";

/**
 * One pager for every list page.
 *
 * shadcn's PaginationLink renders a bare <a> and takes no `asChild`, which would
 * mean a full document load on every page change. Rather than fork a generated
 * file, this composes the same look out of `buttonVariants` around a next/link -
 * public API either way, and the navigation stays client side.
 *
 * `params` is the page's parsed params, passed through whole: paging keeps the
 * search, the filters, the sort and the page size. It used to know about
 * `status` and `email` only.
 */

/**
 * First, last, and the current page with a neighbour either side. Anything more
 * is a row of numbers nobody reads; anything less and you cannot tell where you
 * are in a 40-page list.
 */
function pageWindow(page: number, pages: number): (number | "gap")[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1]);
  const shown = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);

  return shown.flatMap((n, i) => (i > 0 && n - shown[i - 1] > 1 ? ["gap" as const, n] : [n]));
}

export default function Pager({
  base,
  page,
  pages,
  params = {},
}: {
  base: string;
  page: number;
  pages: number;
  params?: Params;
}) {
  if (pages <= 1) return null;

  const link = (n: number) => hrefWith(base, params, { page: n });

  return (
    <Pagination data-testid="pager">
      <PaginationContent>
        <PaginationItem>
          {page > 1 ? (
            <Link
              href={link(page - 1)}
              aria-label="Go to previous page"
              data-testid="pager-previous"
              className={cn(buttonVariants({ variant: "ghost" }), "gap-1 px-2.5")}
            >
              <ChevronLeft />
              <span className="hidden sm:block">Previous</span>
            </Link>
          ) : null}
        </PaginationItem>

        {pageWindow(page, pages).map((entry, i) =>
          entry === "gap" ? (
            <PaginationItem key={`gap-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={entry}>
              <Link
                href={link(entry)}
                aria-current={entry === page ? "page" : undefined}
                data-testid="pager-page"
                className={cn(
                  buttonVariants({ variant: entry === page ? "outline" : "ghost", size: "icon" }),
                  "tabular-nums",
                )}
              >
                {entry}
              </Link>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          {page < pages ? (
            <Link
              href={link(page + 1)}
              aria-label="Go to next page"
              data-testid="pager-next"
              className={cn(buttonVariants({ variant: "ghost" }), "gap-1 px-2.5")}
            >
              <span className="hidden sm:block">Next</span>
              <ChevronRight />
            </Link>
          ) : null}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
