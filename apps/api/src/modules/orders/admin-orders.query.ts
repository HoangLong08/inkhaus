import { BadRequestException } from '@nestjs/common';
import type { OrderSort } from '@inkhaus/shared';
import type { OrderStatus, Prisma } from '@prisma/client';

import { resolveRange } from '../../common/date-range';

export type OrderListFilter = {
  q?: string;
  status?: OrderStatus;
  /** YYYY-MM-DD, inclusive, UTC */
  from?: string;
  /** YYYY-MM-DD, inclusive, UTC */
  to?: string;
  customerId?: string;
};

/** "900002", "ink-900002", "INK900002" - someone typing an order number, not a name */
const ORDER_NUMBER = /^(?:ink-?)?(\d{1,9})$/i;

/**
 * The WHERE for the back-office order list and its CSV export. Pure, so the
 * matching rules are a unit test rather than a fixture.
 *
 * `q` is one box for whatever a person has to hand: part of an order number, an
 * email or a name, matched anywhere and in any case. Something that looks like
 * an order number also matches that number exactly, zero-padded - "ink-12"
 * finds INK-000012, which "contains" alone never would.
 *
 * `from`/`to` pick orders by the day they were placed. A DRAFT has not been
 * placed, so it counts on the day it was created instead - otherwise "this
 * week" would never show the drafts made this week. The date test goes under
 * `AND` because `q` already owns the top-level `OR`.
 */
export function buildOrderWhere(filter: OrderListFilter): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.customerId) where.customerId = filter.customerId;

  const q = filter.q?.trim();
  if (q) {
    const contains = { contains: q, mode: 'insensitive' as const };
    const or: Prisma.OrderWhereInput[] = [
      { number: contains },
      { customer: { email: contains } },
      { customer: { name: contains } },
      { shipName: contains },
    ];
    const digits = ORDER_NUMBER.exec(q)?.[1];
    if (digits) or.push({ number: `INK-${digits.padStart(6, '0')}` });
    where.OR = or;
  }

  const window = dayWindow(filter.from, filter.to);
  if (window) {
    where.AND = [{ OR: [{ placedAt: window }, { placedAt: null, createdAt: window }] }];
  }

  return where;
}

/**
 * `from`/`to` as the half-open `{ gte, lt }` a timestamp filter wants, or null
 * when neither is set. Either end may be missing and then the range is open on
 * that side - the date picker labels a lone bound "From Aug 1" or "Until Aug
 * 31", and that is what it has to mean.
 *
 * There is no cap on the span. `resolveRange` refuses more than a year because
 * it builds a day-by-day series; a paged list has no series to build.
 */
export function dayWindow(from?: string, to?: string): { gte?: Date; lt?: Date } | null {
  if (!from && !to) return null;

  const gte = from ? utcDay(from, 'from').from : undefined;
  const lt = to ? utcDay(to, 'to').toExclusive : undefined;
  if (gte && lt && gte.getTime() >= lt.getTime()) {
    throw new BadRequestException('"from" must be on or before "to"');
  }

  return { ...(gte && { gte }), ...(lt && { lt }) };
}

/**
 * One day, read by `resolveRange` as a one-day range so "a real UTC day" means
 * the same here as on every other date filter. With both ends given it never
 * looks at `now`, and a malformed day is the only thing it can refuse - which is
 * rethrown under the name the caller actually sent.
 */
function utcDay(day: string, name: 'from' | 'to') {
  try {
    return resolveRange({ from: day, to: day }, new Date());
  } catch {
    throw new BadRequestException(`"${name}" must be a date as YYYY-MM-DD`);
  }
}

/**
 * ORDER BY for each of ORDER_SORTS.
 *
 * Every one ends on `seq`, which is unique. Two orders with the same total, or
 * placed in the same second, otherwise come back from Postgres in whatever order
 * it likes - and a list paged with OFFSET then shows one of them twice and skips
 * the other.
 *
 * - `placed_*` put drafts last in both directions: they have no placedAt, and
 *   "oldest first" should start at the oldest order, not at a pile of carts
 *   nobody has checked out. Among themselves they go by creation.
 * - `number_*` go by `seq`, the counter the number is formatted from, rather
 *   than the string: "INK-1000000" sorts before "INK-999999".
 */
export function orderByFor(sort: OrderSort): Prisma.OrderOrderByWithRelationInput[] {
  switch (sort) {
    case 'placed_desc':
      return [{ placedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }, { seq: 'desc' }];
    case 'placed_asc':
      return [{ placedAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { seq: 'asc' }];
    case 'total_desc':
      return [{ total: 'desc' }, { seq: 'desc' }];
    case 'total_asc':
      return [{ total: 'asc' }, { seq: 'asc' }];
    case 'number_desc':
      return [{ seq: 'desc' }];
    case 'number_asc':
      return [{ seq: 'asc' }];
  }
}

/** the filter as the audit log shows it: `q="900002", status=PAID` - or `none` */
export function describeFilter(filter: OrderListFilter): string {
  const parts = [
    filter.q ? `q=${JSON.stringify(filter.q)}` : null,
    filter.status ? `status=${filter.status}` : null,
    filter.from ? `from=${filter.from}` : null,
    filter.to ? `to=${filter.to}` : null,
    filter.customerId ? `customer=${filter.customerId}` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(', ') : 'none';
}
