import { Injectable, NotFoundException } from '@nestjs/common';
import type { AdminUser, OrderStatus, Prisma, QuoteStatus } from '@prisma/client';

import { AuditService } from '../../common/audit/audit.service';
import { num } from '../../common/decimal';
import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  buildCustomerWhere,
  customerEditDiff,
  customerOrderBy,
  foldOrderGroups,
  NO_ORDERS,
  OPEN_QUOTE_STATUSES,
  type CustomerOrderTotals,
} from './admin-customers.query';
import type { AdminListCustomersDto } from './dto/admin-list-customers.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';

/** one row of GET /admin/customers - the admin app parses exactly this shape */
export type AdminCustomerListItem = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  /** signed in with Google at least once; the `sub` itself stays in the database */
  googleLinked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  orderCount: number;
  lifetimeValue: number;
  lastOrderAt: string | null;
};

/** the same shape as a GET /admin/orders item, so the admin draws both with one row */
export type AdminCustomerOrderRow = {
  number: string;
  status: OrderStatus;
  customer: { id: string; email: string; name: string | null };
  units: number;
  total: number;
  currency: string;
  placedAt: string | null;
  createdAt: string;
  carrier: string | null;
  trackingNumber: string | null;
};

export type AdminCustomerQuoteRow = {
  id: string;
  status: QuoteStatus;
  quantity: number;
  product: { slug: string; name: string } | null;
  createdAt: string;
};

export type AdminCustomerDetail = AdminCustomerListItem & {
  /** staff-only. The storefront's customer DTO lists its fields and this is not one of them. */
  adminNote: string | null;
  avatarUrl: string | null;
  stats: {
    refunded: number;
    averageOrder: number;
    firstOrderAt: string | null;
    quoteCount: number;
    openQuoteCount: number;
    designCount: number;
  };
  recentOrders: AdminCustomerOrderRow[];
  quotes: AdminCustomerQuoteRow[];
};

const listSelect = {
  id: true,
  email: true,
  name: true,
  company: true,
  phone: true,
  googleSub: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.CustomerSelect;

const detailSelect = { ...listSelect, adminNote: true, avatarUrl: true } satisfies Prisma.CustomerSelect;

/**
 * What an orders-list row shows, mirrored here rather than imported: the order
 * list's own select belongs to that screen and changes with it, while this tab
 * only ever promises the row shape.
 */
const orderRowSelect = {
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

const quoteRowSelect = {
  id: true,
  status: true,
  quantity: true,
  createdAt: true,
  product: { select: { slug: true, name: true } },
} satisfies Prisma.BulkQuoteSelect;

type ListRow = Prisma.CustomerGetPayload<{ select: typeof listSelect }>;
type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderRowSelect }>;
type QuoteRow = Prisma.BulkQuoteGetPayload<{ select: typeof quoteRowSelect }>;

/** how many orders and quotes the profile shows before "All orders" takes over */
const RECENT = 10;

/** back-office reads and edits of customer records; every edit is audited */
@Injectable()
export class AdminCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: AdminListCustomersDto): Promise<Paginated<AdminCustomerListItem>> {
    const where = buildCustomerWhere(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        select: listSelect,
        orderBy: customerOrderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    const totals = await this.orderTotals(rows.map((r) => r.id));
    return paginate(
      rows.map((r) => toListItem(r, totals.get(r.id) ?? NO_ORDERS)),
      total,
      query,
    );
  }

  async detail(id: string): Promise<AdminCustomerDetail> {
    const customer = await this.prisma.customer.findUnique({ where: { id }, select: detailSelect });
    if (!customer) throw new NotFoundException(`No customer "${id}"`);

    const [totals, recentOrders, quotes, quoteCount, openQuoteCount, designCount] = await Promise.all([
      this.orderTotals([id]),
      this.prisma.order.findMany({
        where: { customerId: id },
        select: orderRowSelect,
        // the orders list's own default, so this tab reads as its first page
        orderBy: [{ placedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        take: RECENT,
      }),
      this.prisma.bulkQuote.findMany({
        where: { customerId: id },
        select: quoteRowSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: RECENT,
      }),
      this.prisma.bulkQuote.count({ where: { customerId: id } }),
      this.prisma.bulkQuote.count({
        where: { customerId: id, status: { in: OPEN_QUOTE_STATUSES } },
      }),
      this.prisma.design.count({ where: { customerId: id } }),
    ]);

    const t = totals.get(id) ?? NO_ORDERS;
    return {
      ...toListItem(customer, t),
      adminNote: customer.adminNote,
      avatarUrl: customer.avatarUrl,
      stats: {
        refunded: t.refunded,
        averageOrder: t.averageOrder,
        firstOrderAt: t.firstOrderAt?.toISOString() ?? null,
        quoteCount,
        openQuoteCount,
        designCount,
      },
      recentOrders: recentOrders.map(toOrderRow),
      quotes: quotes.map(toQuoteRow),
    };
  }

  /**
   * Writes only the fields that actually change, with the audit entry in the
   * same transaction. Two people saving different fields at once therefore
   * cannot overwrite each other; two saving the same field is last-write-wins,
   * and the log holds both.
   */
  async update(id: string, dto: UpdateCustomerDto, actor: AdminUser): Promise<AdminCustomerDetail> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.customer.findUnique({
        where: { id },
        select: { name: true, phone: true, company: true, adminNote: true },
      });
      if (!current) throw new NotFoundException(`No customer "${id}"`);

      const diff = customerEditDiff(current, {
        name: dto.name,
        phone: dto.phone,
        company: dto.company,
        adminNote: dto.adminNote,
      });
      if (!diff) return;

      await tx.customer.update({ where: { id }, data: diff.after });
      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'customer.update',
        entity: 'customer',
        entityId: id,
        summary: `Changed ${Object.keys(diff.after).map(fieldLabel).join(', ')}`,
        before: diff.before,
        after: diff.after,
      });
    });

    return this.detail(id);
  }

  /**
   * Order totals for a set of customers in ONE grouped query, however many are
   * on the page - never a query per row.
   */
  private async orderTotals(customerIds: string[]): Promise<Map<string, CustomerOrderTotals>> {
    if (customerIds.length === 0) return new Map();

    const groups = await this.prisma.order.groupBy({
      by: ['customerId', 'status'],
      where: { customerId: { in: customerIds }, status: { not: 'DRAFT' } },
      _count: { _all: true },
      _sum: { total: true },
      _min: { placedAt: true },
      _max: { placedAt: true },
    });
    return foldOrderGroups(groups);
  }
}

function fieldLabel(field: string) {
  return field === 'adminNote' ? 'note' : field;
}

function toListItem(c: ListRow, t: CustomerOrderTotals): AdminCustomerListItem {
  return {
    id: c.id,
    email: c.email,
    name: c.name,
    company: c.company,
    phone: c.phone,
    googleLinked: c.googleSub !== null,
    lastLoginAt: c.lastLoginAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    orderCount: t.orderCount,
    lifetimeValue: t.lifetimeValue,
    lastOrderAt: t.lastOrderAt?.toISOString() ?? null,
  };
}

function toOrderRow(o: OrderRow): AdminCustomerOrderRow {
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

function toQuoteRow(q: QuoteRow): AdminCustomerQuoteRow {
  return {
    id: q.id,
    status: q.status,
    quantity: q.quantity,
    product: q.product ? { slug: q.product.slug, name: q.product.name } : null,
    createdAt: q.createdAt.toISOString(),
  };
}
