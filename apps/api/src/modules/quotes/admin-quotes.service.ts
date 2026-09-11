import { Injectable, NotFoundException } from '@nestjs/common';
import {
  QuoteEventKind,
  type OrderStatus,
  type Prisma,
  type PrintMethod,
  type QuoteStatus,
} from '@prisma/client';
import { unitPrice } from '@inkhaus/shared';

import { num, round2 } from '../../common/decimal';
import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { buildQuoteWhere, quoteOrderBy } from './admin-quotes.rules';
import type { AdminListQuotesDto } from './dto/admin-list-quotes.dto';

type Person = { id: string; name: string | null; email: string };

/** one row of GET /admin/bulk-quotes - the admin app parses exactly this shape */
export type AdminQuoteListItem = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  product: { slug: string; name: string } | null;
  quantity: number;
  method: PrintMethod | null;
  /** what the calculator quoted when the lead came in */
  estimated: number | null;
  status: QuoteStatus;
  assignee: Person | null;
  /** midnight UTC of the day to chase it */
  followUpAt: string | null;
  convertedOrderNumber: string | null;
  noteCount: number;
  createdAt: string;
  updatedAt: string;
};

/** GET /admin/bulk-quotes/:id */
export type AdminQuoteDetail = AdminQuoteListItem & {
  /** the customer's own words - staff notes are events, never this */
  message: string | null;
  customer: {
    id: string;
    email: string;
    name: string | null;
    company: string | null;
    phone: string | null;
    orderCount: number;
  } | null;
  events: {
    id: string;
    kind: QuoteEventKind;
    status: QuoteStatus | null;
    note: string | null;
    at: string;
    actor: Person | null;
  }[];
  /** the same quantity at today's ladder, beside `estimated` so a price change shows */
  liveEstimate: number | null;
  convertedOrder: { number: string; status: OrderStatus } | null;
};

/** GET /admin/bulk-quotes/conversion-prices */
export type QuoteConversionPrices = {
  products: { slug: string; price: number; bulkPrice: number }[];
};

const person = { select: { id: true, name: true, email: true } } as const;

/** only what a list row shows - no message, no events, no customer */
const listSelect = {
  id: true,
  email: true,
  name: true,
  company: true,
  quantity: true,
  method: true,
  estimated: true,
  status: true,
  followUpAt: true,
  createdAt: true,
  updatedAt: true,
  product: { select: { slug: true, name: true } },
  assignee: person,
  convertedOrder: { select: { number: true, status: true } },
  _count: { select: { events: { where: { kind: QuoteEventKind.NOTE } } } },
} satisfies Prisma.BulkQuoteSelect;

const detailSelect = {
  ...listSelect,
  message: true,
  // the prices are for liveEstimate and never leave this service
  product: { select: { slug: true, name: true, price: true, bulkPrice: true } },
  customer: {
    select: {
      id: true,
      email: true,
      name: true,
      company: true,
      phone: true,
      _count: { select: { orders: true } },
    },
  },
  events: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      kind: true,
      status: true,
      note: true,
      createdAt: true,
      actor: person,
    },
  },
} satisfies Prisma.BulkQuoteSelect;

type ListRow = Prisma.BulkQuoteGetPayload<{ select: typeof listSelect }>;
type DetailRow = Prisma.BulkQuoteGetPayload<{ select: typeof detailSelect }>;

/** back-office reads of bulk quotes; writes go through QuoteWorkflowService */
@Injectable()
export class AdminQuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  async list(
    query: AdminListQuotesDto,
    actorId: string,
    now = new Date(),
  ): Promise<Paginated<AdminQuoteListItem>> {
    const where = buildQuoteWhere(query, actorId, now);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.bulkQuote.findMany({
        where,
        select: listSelect,
        orderBy: quoteOrderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.bulkQuote.count({ where }),
    ]);

    return paginate(rows.map(toListItem), total, query);
  }

  async detail(id: string): Promise<AdminQuoteDetail> {
    const row = await this.prisma.bulkQuote.findUnique({ where: { id }, select: detailSelect });
    if (!row) throw new NotFoundException(`No quote "${id}"`);

    let liveEstimate: number | null = null;
    if (row.product) {
      // total quantity only - a quote has no size breakdown - so this is the
      // tier price times the quantity, exactly how `estimated` was made
      const { tiers } = await this.pricing.ladder();
      const per = unitPrice(
        { price: num(row.product.price), bulkPrice: num(row.product.bulkPrice) },
        row.quantity,
        tiers,
      );
      liveEstimate = round2(per * row.quantity);
    }

    return toDetail(row, liveEstimate);
  }

  /**
   * The list and bulk prices of every product a quote can be converted into -
   * the same set `GET /admin/catalog/options` lists - so the convert dialog
   * can estimate with the shared `quote()` before anything is submitted. The
   * order itself is still priced here, from the database, on submit.
   */
  async conversionPrices(): Promise<QuoteConversionPrices> {
    const rows = await this.prisma.product.findMany({
      where: { active: true },
      select: { slug: true, price: true, bulkPrice: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return {
      products: rows.map((p) => ({ slug: p.slug, price: num(p.price), bulkPrice: num(p.bulkPrice) })),
    };
  }
}

function toListItem(q: ListRow): AdminQuoteListItem {
  return {
    id: q.id,
    email: q.email,
    name: q.name,
    company: q.company,
    product: q.product ? { slug: q.product.slug, name: q.product.name } : null,
    quantity: q.quantity,
    method: q.method,
    estimated: q.estimated === null ? null : num(q.estimated),
    status: q.status,
    assignee: q.assignee,
    followUpAt: q.followUpAt?.toISOString() ?? null,
    convertedOrderNumber: q.convertedOrder?.number ?? null,
    noteCount: q._count.events,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

function toDetail(q: DetailRow, liveEstimate: number | null): AdminQuoteDetail {
  return {
    ...toListItem(q),
    message: q.message,
    customer: q.customer
      ? {
          id: q.customer.id,
          email: q.customer.email,
          name: q.customer.name,
          company: q.customer.company,
          phone: q.customer.phone,
          orderCount: q.customer._count.orders,
        }
      : null,
    events: q.events.map((e) => ({
      id: e.id,
      kind: e.kind,
      status: e.status,
      note: e.note,
      at: e.createdAt.toISOString(),
      actor: e.actor,
    })),
    liveEstimate,
    convertedOrder: q.convertedOrder,
  };
}
