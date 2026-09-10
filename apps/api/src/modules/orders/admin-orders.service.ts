import { Injectable } from '@nestjs/common';
import type { OrderStatus, Prisma } from '@prisma/client';

import { num } from '../../common/decimal';
import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildOrderWhere, ORDER_LIST_ORDER_BY } from './admin-orders.query';
import type { AdminListOrdersDto } from './dto/admin-list-orders.dto';

/** one row of GET /admin/orders - the admin app parses exactly this shape */
export type AdminOrderListItem = {
  number: string;
  status: OrderStatus;
  customer: { id: string; email: string; name: string | null };
  /** total quantity across every line and size */
  units: number;
  total: number;
  currency: string;
  placedAt: string | null;
  createdAt: string;
  carrier: string | null;
  trackingNumber: string | null;
};

/**
 * Only what a list row shows. The legacy list loaded the full include -
 * products, colours, designs with their data-URL previews, every event - twenty
 * times a page to print a unit count.
 */
const listSelect = {
  number: true,
  status: true,
  total: true,
  currency: true,
  placedAt: true,
  createdAt: true,
  carrier: true,
  trackingNumber: true,
  customer: { select: { id: true, email: true, name: true } },
  items: { select: { quantity: true } },
} satisfies Prisma.OrderSelect;

type ListRow = Prisma.OrderGetPayload<{ select: typeof listSelect }>;

@Injectable()
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminListOrdersDto): Promise<Paginated<AdminOrderListItem>> {
    const where = buildOrderWhere(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: listSelect,
        orderBy: ORDER_LIST_ORDER_BY,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return paginate(rows.map(toListItem), total, query);
  }
}

export function toListItem(o: ListRow): AdminOrderListItem {
  return {
    number: o.number,
    status: o.status,
    customer: { id: o.customer.id, email: o.customer.email, name: o.customer.name },
    units: o.items.reduce((n, i) => n + i.quantity, 0),
    total: num(o.total),
    currency: o.currency,
    placedAt: o.placedAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    carrier: o.carrier,
    trackingNumber: o.trackingNumber,
  };
}
