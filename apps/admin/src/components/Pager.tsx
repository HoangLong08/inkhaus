import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
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
  compact = false,
}: {
  base: string;
  page: number;
  pages: number;
  params?: Params;
  /**
   * The footer form: four icon buttons around a "Page 3 of 7" count, instead of
   * the row of page numbers. Off by default, so a page opts in by rendering a
   * `ListFooter` rather than by every list changing at once.
   */
  compact?: boolean;
}) {
  if (pages <= 1) return null;

  const link = (n: number) => hrefWith(base, params, { page: n });
  // An edge button is left out rather than disabled when there is nowhere to go:
  // a disabled <a> is not a thing, and aria-disabled on a link that still
  // navigates is worse than no link at all. `pager-previous` has always done this.
  const edge = cn(
    buttonVariants({ variant: compact ? "outline" : "ghost", size: compact ? "icon-sm" : "icon" }),
    compact && "[&_svg]:size-3.5",
  );
  const step = compact ? edge : cn(buttonVariants({ variant: "ghost" }), "gap-1 px-2.5");

  // The compact form reads "Page 3 of 7  « ‹ › »": the count first, then the four
  // steps together, rather than the count wedged between prev and next.
  if (compact) {
    return (
      <Pagination data-testid="pager" className="mx-0 w-auto items-center justify-end gap-3">
        <span
          data-testid="pager-count"
          data-page={page}
          data-pages={pages}
          className="text-xs font-medium whitespace-nowrap tabular-nums"
        >
          Page {page} of {pages}
        </span>
        <PaginationContent>
          <PaginationItem>
            {page > 1 ? (
              <Link
                href={link(1)}
                aria-label="Go to the first page"
                data-testid="pager-first"
                className={edge}
              >
                <ChevronsLeft />
              </Link>
            ) : null}
          </PaginationItem>
          <PaginationItem>
            {page > 1 ? (
              <Link
                href={link(page - 1)}
                aria-label="Go to previous page"
                data-testid="pager-previous"
                className={edge}
              >
                <ChevronLeft />
              </Link>
            ) : null}
          </PaginationItem>
          <PaginationItem>
            {page < pages ? (
              <Link
                href={link(page + 1)}
                aria-label="Go to next page"
                data-testid="pager-next"
                className={edge}
              >
                <ChevronRight />
              </Link>
            ) : null}
          </PaginationItem>
          <PaginationItem>
            {page < pages ? (
              <Link
                href={link(pages)}
                aria-label="Go to the last page"
                data-testid="pager-last"
                className={edge}
              >
                <ChevronsRight />
              </Link>
            ) : null}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  }

  return (
    <Pagination data-testid="pager">
      <PaginationContent>
        <PaginationItem>
          {page > 1 ? (
            <Link
              href={link(1)}
              aria-label="Go to the first page"
              data-testid="pager-first"
              className={edge}
            >
              <ChevronsLeft />
            </Link>
          ) : null}
        </PaginationItem>

        <PaginationItem>
          {page > 1 ? (
            <Link
              href={link(page - 1)}
              aria-label="Go to previous page"
              data-testid="pager-previous"
              className={step}
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
              className={step}
            >
              <span className="hidden sm:block">Next</span>
              <ChevronRight />
            </Link>
          ) : null}
        </PaginationItem>

        <PaginationItem>
          {page < pages ? (
            <Link
              href={link(pages)}
              aria-label="Go to the last page"
              data-testid="pager-last"
              className={edge}
            >
              <ChevronsRight />
            </Link>
          ) : null}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
