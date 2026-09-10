"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/**
 * Deliberately dumb: a switch on the first segment, not a general-purpose
 * segment humanizer. An order number like INK-2024-0001 must never be
 * title-cased, and there are exactly three sections to name.
 *
 * A client component rather than a `@breadcrumb` parallel route because the
 * latter needs a default.tsx in every segment - five new files to print a string
 * the URL already contains, and one more thing to forget when a route is added.
 *
 * BreadcrumbPage renders role="link" aria-current="page", not a heading, so this
 * never competes with a page's own <h1>.
 */
const SECTIONS: Record<string, string> = {
  orders: "Orders",
  quotes: "Bulk quotes",
};

export function DashBreadcrumb() {
  const segments = usePathname().split("/").filter(Boolean);

  if (segments.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage data-testid="breadcrumb-current">Overview</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  const [section, ...rest] = segments;
  const sectionLabel = SECTIONS[section] ?? section;
  const record = rest.length > 0 ? decodeURIComponent(rest.join("/")) : null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden sm:block">
          {record ? (
            <BreadcrumbLink asChild>
              <Link href={`/${section}`}>{sectionLabel}</Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage data-testid="breadcrumb-current">{sectionLabel}</BreadcrumbPage>
          )}
        </BreadcrumbItem>

        {record ? (
          <>
            <BreadcrumbSeparator className="hidden sm:block" />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-mono" data-testid="breadcrumb-current">
                {record}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
