"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import { breadcrumbFor, type Crumb } from "@/components/nav/nav-config";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useKeyLabel } from "@/i18n/labels";

/**
 * section › sub-section › record, read off `nav-config.ts` - never a
 * general-purpose segment humanizer. An order number like INK-2024-0001 must
 * never be title-cased, and a customer's cuid is not worth printing at all.
 *
 * A client component rather than a `@breadcrumb` parallel route because the
 * latter needs a default.tsx in every segment - a file per route to print a
 * string the URL already contains, and one more thing to forget.
 *
 * BreadcrumbPage renders role="link" aria-current="page", not a heading, so this
 * never competes with a page's own <h1>. On a phone only that last crumb shows.
 */
export function DashBreadcrumb() {
  const crumbs = breadcrumbFor(usePathname());
  const label = useKeyLabel();

  // The Crumb union is what keeps a record id out of t(): a `text` crumb is an
  // order number or a slug and is printed exactly as it arrived.
  const read = (crumb: Crumb) => (crumb.kind === "key" ? label(crumb.labelKey) : crumb.text);
  const mono = (crumb: Crumb) => (crumb.kind === "text" && crumb.mono ? "font-mono" : undefined);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={`${i}-${crumb.href}`}>
              {i > 0 ? <BreadcrumbSeparator className="hidden sm:block" /> : null}
              <BreadcrumbItem className={last ? undefined : "hidden sm:block"}>
                {last ? (
                  <BreadcrumbPage className={mono(crumb)} data-testid="breadcrumb-current">
                    {read(crumb)}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      href={crumb.href}
                      className={mono(crumb)}
                      data-testid="breadcrumb-link"
                    >
                      {read(crumb)}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
