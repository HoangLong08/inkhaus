import { Injectable } from '@nestjs/common';
import type { AdminUser, OrderStatus, Prisma } from '@prisma/client';

import { AuditService } from '../../common/audit/audit.service';
import { num } from '../../common/decimal';
import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  exportFilename,
  exportSummary,
  ORDER_EXPORT_MAX,
  orderCsv,
  orderExportSelect,
} from './admin-order-export.csv';
import { buildOrderWhere, orderByFor } from './admin-orders.query';
import type { AdminListOrdersDto } from './dto/admin-list-orders.dto';
import type { ExportOrdersDto } from './dto/export-orders.dto';

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

/** an export, decided: everything the headers need, and the body still to stream */
export type OrderExport = {
  filename: string;
  /** more orders matched than one file carries */
  truncated: boolean;
  /** the CSV, one chunk per batch, pulled only as fast as the client reads */
  body: AsyncGenerator<string>;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: AdminListOrdersDto): Promise<Paginated<AdminOrderListItem>> {
    const where = buildOrderWhere(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: listSelect,
        orderBy: orderByFor(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return paginate(rows.map(toListItem), total, query);
  }

  /**
   * Everything about an export that has to be settled before the first byte:
   * the headers - `X-Export-Truncated` among them - go out ahead of the body,
   * and a bad date must still be a 400 rather than a half-written file.
   *
   * The rows are chosen here, as ids in the list's own order and capped: when
   * more match than one file carries, the owner gets the ones at the top of the
   * list they were looking at - the newest, by default - not whichever sort
   * order a database cursor happens to walk in. Fixing the ids up front also
   * means an order placed mid-download cannot shift one batch into the next.
   * Ten thousand ids are a few hundred kilobytes; the rows themselves are read
   * in batches while the file streams.
   *
   * Audited before anything is sent (decision D6). An export that fails half
   * way has still put personal data on the wire, and the log should err
   * towards saying so.
   */
  async exportCsv(filter: ExportOrdersDto, actor: AdminUser): Promise<OrderExport> {
    const where = buildOrderWhere(filter);

    const [total, picked] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        select: { id: true },
        orderBy: orderByFor(filter.sort),
        take: ORDER_EXPORT_MAX,
      }),
    ]);
    const ids = picked.map((o) => o.id);

    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'orders.export',
      entity: 'orders',
      entityId: 'export',
      summary: exportSummary(ids.length, total, filter.sort, filter),
    });

    return {
      filename: exportFilename(new Date()),
      truncated: total > ORDER_EXPORT_MAX,
      body: orderCsv(ids, (batch) =>
        this.prisma.order.findMany({ where: { id: { in: batch } }, select: orderExportSelect }),
      ),
    };
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
