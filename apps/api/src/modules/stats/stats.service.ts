import { REVENUE_STATUSES, STATS_RANGE_DAYS, type StatsRange } from '@inkhaus/shared';
import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma, QuoteStatus, ReviewStatus } from '@prisma/client';

import {
  isoDay,
  resolveRange,
  type DateRangeInput,
  type ResolvedRange,
} from '../../common/date-range';
import { num, round2 } from '../../common/decimal';
import { PrismaService } from '../../common/prisma/prisma.service';
import { conversionRate, fillDailySeries, type DailyPoint } from './stats.series';

const HOUR_MS = 60 * 60 * 1000;
/** a NEW quote nobody has picked up in this long is going cold */
const STALE_QUOTE_MS = 48 * HOUR_MS;
/** a paid or in-production order that has not changed in this long is stuck */
const STUCK_ORDER_MS = 72 * HOUR_MS;
/** each attention list is a nudge, not a report - the lists themselves are one click away */
const ATTENTION_LIMIT = 5;
const TOP_PRODUCTS = 5;
const DEFAULT_RANGE: StatsRange = '30d';

export type TopProduct = { slug: string; name: string; units: number; revenue: number };

export type StaleQuote = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  createdAt: string;
};

export type OverdueFollowUp = {
  id: string;
  email: string;
  name: string | null;
  followUpAt: string;
  assignee: { id: string; name: string | null; email: string } | null;
};

export type StuckOrder = { number: string; status: OrderStatus; since: string };

/**
 * GET /admin/stats/overview - the admin app parses this. The baseline keys
 * (`orders.byStatus`, `quotes.byStatus`, `reviews.pending`) are all-time and
 * unchanged; everything else is additive.
 */
export type StatsOverview = {
  /** the window the range-bound figures cover: inclusive UTC days */
  range: { from: string; to: string; days: number; key: StatsRange | null };
  /** `byStatus` is all time; `placed` is orders placed in the range, any status but DRAFT */
  orders: { byStatus: Record<OrderStatus, number>; placed: number };
  /** orders placed in the range: REVENUE_STATUSES earn, REFUNDED is reported beside them */
  revenue: { gross: number; orders: number; averageOrder: number; refunded: number };
  /** one point per day of the range, revenue statuses only, zero-filled */
  series: DailyPoint[];
  /** by line revenue from revenue-status orders placed in the range */
  topProducts: TopProduct[];
  /**
   * `byStatus` is all time. `created` and `createdByStatus` are the quotes
   * created in the range, by where they stand now; `conversionRate` is WON over
   * WON + LOST among those, null when none is decided.
   */
  quotes: {
    byStatus: Record<QuoteStatus, number>;
    created: number;
    createdByStatus: Record<QuoteStatus, number>;
    conversionRate: number | null;
  };
  reviews: { pending: number };
  /** DRAFT orders, all time - the same number as `orders.byStatus.DRAFT` */
  drafts: number;
  /** right now, whatever the range - oldest first, five of each at most */
  attention: {
    staleQuotes: StaleQuote[];
    overdueFollowUps: OverdueFollowUp[];
    stuckOrders: StuckOrder[];
  };
};

/** a half-open interval, as Prisma filters it */
type Span = { gte: Date; lt: Date };

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The overview, from one grouped read per question rather than a list per
   * tile - the admin used to fetch five full order lists only to read
   * `meta.total` off each (bug 4). The blocks do not depend on each other, so
   * they are read side by side.
   */
  async overview(input: DateRangeInput = {}, now = new Date()): Promise<StatsOverview> {
    const range = resolveRange(input, now, { defaultDays: STATS_RANGE_DAYS[DEFAULT_RANGE] });
    const span: Span = { gte: range.from, lt: range.toExclusive };

    const [byStatus, inRange, series, topProducts, quotes, pending, attention] = await Promise.all([
      this.ordersByStatus(),
      this.ordersInRange(span),
      this.dailySeries(range),
      this.topProducts(span),
      this.quotes(span),
      this.prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
      this.attention(now),
    ]);

    return {
      range: {
        from: range.days[0],
        to: range.days[range.days.length - 1],
        days: range.days.length,
        key: rangeKey(input),
      },
      orders: { byStatus, placed: inRange.placed },
      revenue: inRange.revenue,
      series,
      topProducts,
      quotes,
      reviews: { pending },
      drafts: byStatus.DRAFT,
      attention,
    };
  }

  private async ordersByStatus() {
    const rows = await this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } });
    return tally(Object.values(OrderStatus), rows);
  }

  /**
   * Everything the range says about orders, from one grouped read: how many
   * were placed, what the revenue statuses earned, and what was refunded.
   * Refunds are reported beside revenue, not netted out of it, so neither
   * number hides the other. A DRAFT has no placedAt, so the window alone would
   * keep drafts out; the status filter says so out loud.
   */
  private async ordersInRange(span: Span) {
    const rows = await this.prisma.order.groupBy({
      by: ['status'],
      where: { placedAt: span, status: { not: OrderStatus.DRAFT } },
      _count: { _all: true },
      _sum: { total: true },
    });

    const earning = rows.filter((row) => REVENUE_STATUSES.includes(row.status));
    const gross = round2(earning.reduce((sum, row) => sum + num(row._sum.total), 0));
    const orders = earning.reduce((n, row) => n + row._count._all, 0);
    const refunded = rows.find((row) => row.status === OrderStatus.REFUNDED);

    return {
      placed: rows.reduce((n, row) => n + row._count._all, 0),
      revenue: {
        gross,
        orders,
        averageOrder: orders === 0 ? 0 : round2(gross / orders),
        refunded: round2(num(refunded?._sum.total)),
      },
    };
  }

  /**
   * Revenue and paid-order counts per UTC day (D8), bucketed by the database.
   *
   * `placedAt` is `timestamp(3)` WITHOUT time zone holding UTC wall-clock time -
   * how Prisma stores every DateTime - so a plain `date_trunc('day', ...)` is
   * already the UTC day. The tempting `"placedAt" AT TIME ZONE 'UTC'` does the
   * opposite of what it reads as on this column type: it yields a timestamptz,
   * and date_trunc then cuts days in the connection's TimeZone setting. The
   * bounds are day strings cast to `timestamp` for the same reason: wall clock
   * against wall clock, whatever zone the session is in.
   */
  private async dailySeries(range: ResolvedRange): Promise<DailyPoint[]> {
    const rows = await this.prisma.$queryRaw<
      { day: Date; orders: number; revenue: Prisma.Decimal | null }[]
    >(Prisma.sql`
      SELECT date_trunc('day', "placedAt") AS "day",
             count(*)::int AS "orders",
             sum("total") AS "revenue"
      FROM "orders"
      WHERE "status"::text IN (${Prisma.join(REVENUE_STATUSES)})
        AND "placedAt" >= ${isoDay(range.from)}::timestamp
        AND "placedAt" < ${isoDay(range.toExclusive)}::timestamp
      GROUP BY 1
    `);

    return fillDailySeries(
      range.days,
      rows.map((row) => ({ day: row.day, orders: row.orders, revenue: num(row.revenue) })),
    );
  }

  /**
   * The five best sellers by line revenue - merchandise, before shipping, tax
   * and discounts - so their sum is not meant to equal `revenue.gross`. Ties
   * break on the id, so the list does not reshuffle between two loads.
   */
  private async topProducts(span: Span): Promise<TopProduct[]> {
    const rows = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { status: { in: REVENUE_STATUSES }, placedAt: span } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: [{ _sum: { lineTotal: 'desc' } }, { productId: 'asc' }],
      take: TOP_PRODUCTS,
    });
    if (rows.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: { id: { in: rows.map((row) => row.productId) } },
      select: { id: true, slug: true, name: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));

    // products are archived, never deleted, so every id resolves; flatMap
    // keeps the types honest without an assertion
    return rows.flatMap((row) => {
      const product = byId.get(row.productId);
      return product
        ? [
            {
              slug: product.slug,
              name: product.name,
              units: row._sum.quantity ?? 0,
              revenue: num(row._sum.lineTotal),
            },
          ]
        : [];
    });
  }

  /**
   * The funnel reads the quotes CREATED in the range, by where they stand now,
   * so its counts add up to `created` and the conversion rate is taken over the
   * same set - not all-time statuses beside an in-range rate.
   */
  private async quotes(span: Span): Promise<StatsOverview['quotes']> {
    const [all, created] = await Promise.all([
      this.prisma.bulkQuote.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.bulkQuote.groupBy({
        by: ['status'],
        where: { createdAt: span },
        _count: { _all: true },
      }),
    ]);
    const createdByStatus = tally(Object.values(QuoteStatus), created);

    return {
      byStatus: tally(Object.values(QuoteStatus), all),
      created: created.reduce((n, row) => n + row._count._all, 0),
      createdByStatus,
      conversionRate: conversionRate(createdByStatus.WON, createdByStatus.LOST),
    };
  }

  /** what is waiting on a person right now, whatever range the page shows */
  private async attention(now: Date): Promise<StatsOverview['attention']> {
    const [stale, overdue, stuck] = await Promise.all([
      this.prisma.bulkQuote.findMany({
        where: {
          status: QuoteStatus.NEW,
          createdAt: { lt: new Date(now.getTime() - STALE_QUOTE_MS) },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: ATTENTION_LIMIT,
        select: { id: true, email: true, name: true, company: true, createdAt: true },
      }),
      this.prisma.bulkQuote.findMany({
        where: {
          status: { in: [QuoteStatus.NEW, QuoteStatus.CONTACTED] },
          followUpAt: { lt: now },
        },
        orderBy: [{ followUpAt: 'asc' }, { id: 'asc' }],
        take: ATTENTION_LIMIT,
        select: {
          id: true,
          email: true,
          name: true,
          followUpAt: true,
          assignee: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.order.findMany({
        where: {
          status: { in: [OrderStatus.PAID, OrderStatus.IN_PRODUCTION] },
          updatedAt: { lt: new Date(now.getTime() - STUCK_ORDER_MS) },
        },
        orderBy: [{ updatedAt: 'asc' }, { number: 'asc' }],
        take: ATTENTION_LIMIT,
        select: { number: true, status: true, updatedAt: true },
      }),
    ]);

    return {
      staleQuotes: stale.map((quote) => ({ ...quote, createdAt: quote.createdAt.toISOString() })),
      overdueFollowUps: overdue.map((quote) => ({
        id: quote.id,
        email: quote.email,
        name: quote.name,
        // the `lt` filter above only matches rows that have one
        followUpAt: quote.followUpAt!.toISOString(),
        assignee: quote.assignee,
      })),
      stuckOrders: stuck.map((order) => ({
        number: order.number,
        status: order.status,
        since: order.updatedAt.toISOString(),
      })),
    };
  }
}

/**
 * The preset the window came from, or null for an explicit from/to - which
 * wins over a preset in resolveRange as well. resolveRange has already refused
 * a preset it does not know, so the cast only narrows.
 */
function rangeKey(input: DateRangeInput): StatsRange | null {
  if (input.from || input.to) return null;
  return (input.range as StatsRange | undefined) ?? DEFAULT_RANGE;
}

/**
 * A count for every value, zero included. `groupBy` only returns the statuses
 * that have rows, and a tile with nothing in it should say 0, not vanish.
 */
function tally<K extends string>(
  keys: readonly K[],
  rows: readonly { status: K; _count: { _all: number } }[],
): Record<K, number> {
  const counts = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const row of rows) counts[row.status] = row._count._all;
  return counts;
}
