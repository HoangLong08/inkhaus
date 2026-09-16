import { can, REVIEW_STATUSES, type AdminAction } from "@inkhaus/shared/admin";
import {
  QUOTE_STATUSES,
  type AdminRoleCode,
  type OrderStatusCode,
} from "@inkhaus/shared/orders";
import {
  FileText,
  LayoutDashboard,
  Package,
  Shirt,
  Star,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * The one list of what the back office contains. The sidebar, the breadcrumb and
 * the role filter all read it, so a new section is one entry here rather than
 * three edits that have to agree.
 *
 * FROZEN after Phase 0. Every section the plan calls for is already listed. It
 * carries `labelKey`s, never sentences: this module is machine-readable, and the
 * words live in messages/{en,vi}.json. `i18n-check` assertion 6 asserts that
 * every key written here resolves in both catalogues.
 */

export type NavChild = {
  /** machine value - `data-value` on the sidebar link */
  value: string;
  /** a fully qualified message key, so the consumer needs no namespace */
  labelKey: string;
  /**
   * A path, optionally with a query string. With one (`/orders?status=PAID`)
   * it is a FILTER: lit when the path is equal and every param matches. Without
   * one (`/catalog/colors`) it is a SUB-SECTION: lit anywhere under its path,
   * and it shows in the breadcrumb.
   */
  href: string;
  /** a sub-section that owns records under a different prefix (`/catalog/products/<slug>`) */
  recordBase?: string;
  capability?: AdminAction;
};

export type NavSection = {
  /** `data-section` on every link the sidebar draws for it */
  id: string;
  /** a fully qualified message key, so the consumer needs no namespace */
  labelKey: string;
  href: string;
  icon: LucideIcon;
  capability?: AdminAction;
  /**
   * How a record id under this section reads in the breadcrumb. Unset means the
   * id itself, in monospace - an order number or a product slug is worth
   * reading; a cuid is not, so customers and quotes say "Customer" / "Quote".
   */
  recordLabelKey?: string;
  children?: readonly NavChild[];
};

/**
 * The four an operator actually works from. The other four order statuses -
 * DRAFT, DELIVERED, CANCELLED, REFUNDED - are archive states: real, filterable
 * from the list page, but not a queue anybody starts their morning in.
 */
export const ORDER_QUEUES: readonly OrderStatusCode[] = [
  "PENDING_PAYMENT",
  "PAID",
  "IN_PRODUCTION",
  "SHIPPED",
];

/** a status child reads its label straight out of the shared Status table */
const byStatus = (base: string, statuses: readonly string[]): NavChild[] =>
  statuses.map((status) => ({
    value: status,
    labelKey: `Status.${status}`,
    href: `${base}?status=${status}`,
  }));

export const NAV: readonly NavSection[] = [
  {
    id: "overview",
    labelKey: "Nav.section.overview",
    href: "/",
    icon: LayoutDashboard,
    capability: "stats.view",
  },
  {
    id: "orders",
    labelKey: "Nav.section.orders",
    href: "/orders",
    icon: Package,
    capability: "orders.view",
    children: byStatus("/orders", ORDER_QUEUES),
  },
  {
    id: "quotes",
    labelKey: "Nav.section.quotes",
    href: "/quotes",
    icon: FileText,
    capability: "quotes.manage",
    recordLabelKey: "Breadcrumb.record.quotes",
    children: [
      ...byStatus("/quotes", QUOTE_STATUSES),
      { value: "mine", labelKey: "Nav.child.mine", href: "/quotes?assignee=me" },
    ],
  },
  {
    id: "customers",
    labelKey: "Nav.section.customers",
    href: "/customers",
    icon: Users,
    capability: "customers.view",
    recordLabelKey: "Breadcrumb.record.customers",
  },
  {
    id: "catalog",
    labelKey: "Nav.section.catalog",
    href: "/catalog",
    icon: Shirt,
    capability: "catalog.view",
    children: [
      {
        value: "products",
        labelKey: "Nav.child.products",
        href: "/catalog",
        recordBase: "/catalog/products",
      },
      { value: "colors", labelKey: "Nav.child.colors", href: "/catalog/colors" },
      { value: "sizes", labelKey: "Nav.child.sizes", href: "/catalog/sizes" },
      { value: "pricing", labelKey: "Nav.child.pricing", href: "/catalog/pricing" },
    ],
  },
  {
    id: "reviews",
    labelKey: "Nav.section.reviews",
    href: "/reviews",
    icon: Star,
    capability: "reviews.moderate",
    children: byStatus("/reviews", REVIEW_STATUSES),
  },
  {
    id: "staff",
    labelKey: "Nav.section.staff",
    href: "/staff",
    icon: UserCog,
    capability: "staff.view",
  },
];

/* ---------------------------------------------------------------- matching */

type Search = { get(name: string): string | null };

/** `/orders` owns itself and everything under it; `/` owns only itself */
export function ownsPath(prefix: string, pathname: string) {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function split(href: string) {
  const url = new URL(href, "http://nav.invalid");
  return { path: url.pathname, query: [...url.searchParams.entries()] };
}

function isSubSection(child: NavChild) {
  return !child.href.includes("?");
}

/** the sections, and the children within them, this role may reach */
export function visibleNav(role: AdminRoleCode): NavSection[] {
  return NAV.filter((section) => !section.capability || can(role, section.capability)).map(
    (section) => ({
      ...section,
      children: section.children?.filter((child) => !child.capability || can(role, child.capability)),
    }),
  );
}

/**
 * The `value`s of the children the current URL is on. A section's own link is
 * lit only when this is empty - which is what lights "Orders" on
 * `/orders?status=DELIVERED`, an archive status with no child of its own, where
 * the nav used to show nothing selected at all.
 */
export function activeChildren(section: NavSection, pathname: string, search: Search) {
  const lit = new Set<string>();
  for (const child of section.children ?? []) {
    const { path, query } = split(child.href);
    const on = isSubSection(child)
      ? pathname === path || ownsPath(child.recordBase ?? path, pathname)
      : pathname === path && query.every(([key, value]) => search.get(key) === value);
    if (on) lit.add(child.value);
  }
  return lit;
}

/* -------------------------------------------------------------- breadcrumb */

/**
 * A crumb is either a key to translate or a string to print verbatim, and the
 * union is how this file's own rule is expressed in the type system: an order
 * number like INK-2024-0001 must never be title-cased, and a record id must
 * never reach `t()`. A reviewer can see which branch is which at a glance.
 */
export type Crumb =
  | { kind: "key"; labelKey: string; href: string }
  | { kind: "text"; text: string; href: string; mono?: boolean };

function decode(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * section › sub-section › record, from the path alone. Filters are not
 * crumbs: `/orders?status=PAID` is still just "Orders". The last crumb is the
 * current page.
 */
export function breadcrumbFor(pathname: string): Crumb[] {
  if (pathname === "/") return [{ kind: "key", labelKey: "Nav.section.overview", href: "/" }];

  const section = NAV.find((s) => s.href !== "/" && ownsPath(s.href, pathname));
  if (!section) {
    // a route nobody registered: say what the URL says rather than nothing. The
    // URL is not copy, so it is printed, never translated.
    const [first, ...rest] = pathname.split("/").filter(Boolean);
    const crumbs: Crumb[] = [{ kind: "text", text: decode(first), href: `/${first}` }];
    if (rest.length) {
      crumbs.push({ kind: "text", text: rest.map(decode).join("/"), href: pathname, mono: true });
    }
    return crumbs;
  }

  const crumbs: Crumb[] = [{ kind: "key", labelKey: section.labelKey, href: section.href }];

  let recordBase = section.href;
  const sub = section.children?.find(
    (child) =>
      isSubSection(child) &&
      (pathname === child.href || ownsPath(child.recordBase ?? child.href, pathname)),
  );
  if (sub) {
    crumbs.push({ kind: "key", labelKey: sub.labelKey, href: sub.href });
    recordBase = sub.recordBase ?? sub.href;
  }

  const rest = pathname.startsWith(`${recordBase}/`)
    ? pathname.slice(recordBase.length + 1).split("/").filter(Boolean)
    : [];
  if (rest.length > 0) {
    const id = rest.map(decode).join("/");
    if (section.recordLabelKey) {
      crumbs.push({ kind: "key", labelKey: section.recordLabelKey, href: pathname });
    } else if (id === "new") {
      crumbs.push({ kind: "key", labelKey: "Breadcrumb.new", href: pathname });
    } else {
      crumbs.push({ kind: "text", text: id, href: pathname, mono: true });
    }
  }

  return crumbs;
}
