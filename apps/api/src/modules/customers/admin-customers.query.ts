import type { OrderStatus, Prisma, QuoteStatus } from '@prisma/client';
import { REVENUE_STATUSES, type CustomerOrderFilter, type CustomerSort } from '@inkhaus/shared';

import { num } from '../../common/decimal';

/**
 * The pure half of the back-office customer screens: the list's WHERE and ORDER
 * BY, the fold that turns one grouped order query into per-customer totals, and
 * the diff an edit is audited with. Pure so each rule is a unit test rather than
 * a fixture.
 *
 * `?hasOrders=` takes CUSTOMER_ORDER_FILTERS from @inkhaus/shared, the same
 * list the admin's filter links are built from.
 */

export type CustomerListFilter = { q?: string; hasOrders?: CustomerOrderFilter };

/** a quote somebody still has to act on */
export const OPEN_QUOTE_STATUSES: QuoteStatus[] = ['NEW', 'CONTACTED'];

/**
 * An order counts once it has left DRAFT. A draft is a quote being turned into
 * an order by staff, not something the customer bought, so it is neither an
 * order on their record nor a reason to list them under "with orders".
 */
const PLACED: Prisma.OrderWhereInput = { status: { not: 'DRAFT' } };

/**
 * `q` is one box for whatever a person has to hand - part of an email, a name,
 * a company or a phone number - matched anywhere and in any case.
 */
export function buildCustomerWhere(filter: CustomerListFilter): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {};

  const q = filter.q?.trim();
  if (q) {
    const contains = { contains: q, mode: 'insensitive' as const };
    where.OR = [{ email: contains }, { name: contains }, { company: contains }, { phone: contains }];
  }

  if (filter.hasOrders === 'yes') where.orders = { some: PLACED };
  if (filter.hasOrders === 'no') where.orders = { none: PLACED };

  return where;
}

/**
 * Every sort ends on a unique column, so a page boundary never falls between
 * two rows that compare equal - otherwise one customer could show on page 1 and
 * again on page 2 while another shows on neither.
 *
 * Every sortable column sorts both ways - the header flips it on a second
 * click - and the reverse of a sort is the whole sort reversed, tie-breakers
 * included, so page 1 of one direction is the last page of the other.
 *
 * Names and sign-ins are optional; a customer without one goes to the end in
 * BOTH directions rather than Postgres' default of the top for one of them:
 * "never signed in" is not the oldest sign-in. `orders_*` rank on the relation
 * count, which Prisma cannot filter, so drafts count towards the rank even
 * though the Orders column leaves them out - a draft is rare and the order is
 * only ever off by it.
 */
export function customerOrderBy(sort: CustomerSort): Prisma.CustomerOrderByWithRelationInput[] {
  switch (sort) {
    case 'created_asc':
      return [{ createdAt: 'asc' }, { id: 'asc' }];
    case 'name_asc':
      return [{ name: { sort: 'asc', nulls: 'last' } }, { email: 'asc' }];
    case 'name_desc':
      return [{ name: { sort: 'desc', nulls: 'last' } }, { email: 'desc' }];
    case 'orders_desc':
      return [{ orders: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }];
    case 'orders_asc':
      return [{ orders: { _count: 'asc' } }, { createdAt: 'asc' }, { id: 'asc' }];
    case 'login_desc':
      return [{ lastLoginAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'desc' }];
    case 'login_asc':
      return [{ lastLoginAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }];
    case 'created_desc':
    default:
      return [{ createdAt: 'desc' }, { id: 'desc' }];
  }
}

// ------------------------------------------------------------------ totals

/** one row of `order.groupBy({ by: ['customerId', 'status'] })` with every aggregate the screens read */
export type OrderGroup = {
  customerId: string;
  status: OrderStatus;
  _count: { _all: number };
  _sum: { total: Prisma.Decimal | number | null };
  _min: { placedAt: Date | null };
  _max: { placedAt: Date | null };
};

export type CustomerOrderTotals = {
  /** every order that left DRAFT, cancelled and refunded included */
  orderCount: number;
  /** Σ total over REVENUE_STATUSES - money in and not given back */
  lifetimeValue: number;
  /** lifetimeValue over the orders it came from */
  averageOrder: number;
  /** Σ total of REFUNDED orders */
  refunded: number;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
};

export const NO_ORDERS: CustomerOrderTotals = {
  orderCount: 0,
  lifetimeValue: 0,
  averageOrder: 0,
  refunded: 0,
  firstOrderAt: null,
  lastOrderAt: null,
};

const REVENUE = new Set<string>(REVENUE_STATUSES);

/** totals are Decimal(10, 2): whole cents add up exactly where floats would drift */
const cents = (value: Prisma.Decimal | number | null) => Math.round(num(value) * 100);

const earlier = (a: Date | null, b: Date | null) => (a && b ? (a < b ? a : b) : (a ?? b));
const later = (a: Date | null, b: Date | null) => (a && b ? (a > b ? a : b) : (a ?? b));

/**
 * Folds the rows of ONE grouped query - every customer on the page, split by
 * status - into a total per customer. The list used to be the textbook place
 * for a query per row; grouping by status as well is what lets a single query
 * answer the count, the lifetime value and the refunds at once.
 *
 * DRAFT groups are skipped even though the caller filters them out, so the
 * totals do not depend on a WHERE clause somewhere else staying right.
 */
export function foldOrderGroups(groups: readonly OrderGroup[]): Map<string, CustomerOrderTotals> {
  type Acc = { orders: number; revenueOrders: number; revenue: number; refunded: number; first: Date | null; last: Date | null };
  const acc = new Map<string, Acc>();

  for (const g of groups) {
    if (g.status === 'DRAFT') continue;
    const a = acc.get(g.customerId) ?? { orders: 0, revenueOrders: 0, revenue: 0, refunded: 0, first: null, last: null };

    a.orders += g._count._all;
    if (REVENUE.has(g.status)) {
      a.revenueOrders += g._count._all;
      a.revenue += cents(g._sum.total);
    }
    if (g.status === 'REFUNDED') a.refunded += cents(g._sum.total);
    a.first = earlier(a.first, g._min.placedAt);
    a.last = later(a.last, g._max.placedAt);

    acc.set(g.customerId, a);
  }

  const totals = new Map<string, CustomerOrderTotals>();
  for (const [customerId, a] of acc) {
    totals.set(customerId, {
      orderCount: a.orders,
      lifetimeValue: a.revenue / 100,
      averageOrder: a.revenueOrders ? Math.round(a.revenue / a.revenueOrders) / 100 : 0,
      refunded: a.refunded / 100,
      firstOrderAt: a.first,
      lastOrderAt: a.last,
    });
  }
  return totals;
}

// -------------------------------------------------------------------- edits

/**
 * What staff may change about a customer. Email is not here and never will be:
 * orders, designs and quotes are filed under it, and storefront sign-in matches
 * a Google account to the customer by it.
 */
export const CUSTOMER_EDITABLE = ['name', 'phone', 'company', 'adminNote'] as const;

export type CustomerEditable = (typeof CUSTOMER_EDITABLE)[number];

export type CustomerEditValues = Record<CustomerEditable, string | null>;

/**
 * How an edited text field is stored: trimmed, and blank means "not known"
 * rather than an empty string that renders as nothing and sorts first. Anything
 * that is not a string is passed through for the validator to refuse.
 */
export function normaliseText(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export type CustomerEditDiff = {
  before: Partial<CustomerEditValues>;
  after: Partial<CustomerEditValues>;
};

/**
 * The fields an edit really changes, as they were and as they will be - what
 * gets written and what the audit log records. A field left out of the patch,
 * or sent with the value it already has, is not a change. Null when nothing
 * changes at all, so a no-op save writes neither the row nor a log entry.
 */
export function customerEditDiff(
  current: CustomerEditValues,
  patch: Partial<Record<CustomerEditable, string | null | undefined>>,
): CustomerEditDiff | null {
  const before: Partial<CustomerEditValues> = {};
  const after: Partial<CustomerEditValues> = {};

  for (const field of CUSTOMER_EDITABLE) {
    if (patch[field] === undefined) continue;
    const next = normaliseText(patch[field]) as string | null;
    if (next === current[field]) continue;
    before[field] = current[field];
    after[field] = next;
  }

  return Object.keys(after).length ? { before, after } : null;
}
