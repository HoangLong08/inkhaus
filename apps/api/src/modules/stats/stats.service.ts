import { Injectable } from '@nestjs/common';
import { OrderStatus, QuoteStatus, ReviewStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

/** GET /admin/stats/overview - the admin app parses this; later fields are additive */
export type StatsOverview = {
  orders: { byStatus: Record<OrderStatus, number> };
  quotes: { byStatus: Record<QuoteStatus, number> };
  reviews: { pending: number };
};

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The overview tiles. One grouped count per table - the admin used to fetch
   * five full order lists only to read `meta.total` off each (bug 4).
   */
  async overview(): Promise<StatsOverview> {
    const [orders, quotes, pending] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.bulkQuote.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
    ]);

    return {
      orders: { byStatus: tally(Object.values(OrderStatus), orders) },
      quotes: { byStatus: tally(Object.values(QuoteStatus), quotes) },
      reviews: { pending },
    };
  }
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
