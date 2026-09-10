import type { OrderStatus, Prisma } from '@prisma/client';

export type OrderListFilter = { q?: string; status?: OrderStatus };

/** "900002", "ink-900002", "INK900002" - someone typing an order number, not a name */
const ORDER_NUMBER = /^(?:ink-?)?(\d{1,9})$/i;

/**
 * The WHERE for the back-office order list. Pure, so the matching rules are a
 * unit test rather than a fixture.
 *
 * `q` is one box for whatever a person has to hand: part of an order number, an
 * email or a name, matched anywhere and in any case. Something that looks like
 * an order number also matches that number exactly, zero-padded - "ink-12"
 * finds INK-000012, which "contains" alone never would.
 */
export function buildOrderWhere(filter: OrderListFilter): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (filter.status) where.status = filter.status;

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

  return where;
}

/**
 * Newest first by when the order was placed. A DRAFT has no placedAt yet, so
 * drafts go to the end rather than Postgres' default of the top, and fall back
 * to creation order among themselves.
 */
export const ORDER_LIST_ORDER_BY = [
  { placedAt: { sort: 'desc', nulls: 'last' } },
  { createdAt: 'desc' },
] satisfies Prisma.OrderOrderByWithRelationInput[];
