import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PUBLIC_ORDER_EVENT_KINDS } from '@inkhaus/shared';

import { num } from '../../common/decimal';
import { paginate, type PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { ListOrdersDto } from './dto/list-orders.dto';
import type { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderBuilderService } from './order-builder.service';
import { OrderWorkflowService, type WorkflowActor } from './order-workflow.service';
import { toTracking } from './tracking';

export const publicOrderInclude = {
  customer: true,
  items: { include: { product: true, color: true, design: true, sizes: true } },
  // Staff notes never leave the back office (decision D3), so this DTO does not
  // even load them. `toPublicOrder` filters again: it is the last line, and a
  // caller with its own include should not be able to leak one.
  events: {
    where: { kind: { in: [...PUBLIC_ORDER_EVENT_KINDS] } },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.OrderInclude;

export type PublicOrderRow = Prisma.OrderGetPayload<{ include: typeof publicOrderInclude }>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
    private readonly builder: OrderBuilderService,
    private readonly workflow: OrderWorkflowService,
  ) {}

  /**
   * Checkout. Prices every line from the database and writes the order in one
   * transaction - see OrderBuilderService, which a converted bulk quote goes
   * through too. Nothing the client sends about money is trusted.
   */
  async create(dto: CreateOrderDto) {
    const customer = await this.customers.findOrCreate(dto.customer.email, {
      name: dto.customer.name,
      phone: dto.customer.phone,
      company: dto.customer.company,
    });
    const priced = await this.builder.priceItems(dto.items);
    const totals = this.builder.totals(priced);

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await this.builder.createOrder(tx, {
        customerId: customer.id,
        status: OrderStatus.PENDING_PAYMENT,
        placedAt: new Date(),
        priced,
        totals,
        shipping: dto.shipping,
        notes: dto.notes,
        event: { status: OrderStatus.PENDING_PAYMENT, note: 'Order placed' },
      });
      return tx.order.findUniqueOrThrow({ where: { id: created.id }, include: publicOrderInclude });
    });

    return toPublicOrder(order);
  }

  /**
   * The storefront's order page - public, keyed by nothing but the number.
   *
   * An order that was never placed is a 404 here, exactly as if it did not
   * exist. That is every DRAFT - a bulk quote staff are still turning into an
   * order, whose notes are what staff typed in the convert dialog and whose
   * address is the customer's - and a draft that was cancelled before anyone
   * placed it, which is no longer DRAFT but holds the same staff text. `placedAt`
   * is set only on the move to PENDING_PAYMENT, so it is the one test that
   * covers both. The admin detail endpoint reads its own include and is
   * unaffected.
   */
  async findByNumber(number: string) {
    const order = await this.load(number);
    if (order.placedAt === null) throw new NotFoundException(`No order "${number}"`);
    return toPublicOrder(order);
  }

  private async load(number: string) {
    const order = await this.prisma.order.findUnique({
      where: { number },
      include: publicOrderInclude,
    });
    if (!order) throw new NotFoundException(`No order "${number}"`);
    return order;
  }

  /**
   * Every order belonging to the signed-in shopper, newest first.
   *
   * Scoped by `customerId` from the session and never by anything in the
   * request, which is what separates this from `list()` below: there is no
   * parameter here a caller could bend into someone else's history.
   *
   * Orders that were never placed are left out for the reason `findByNumber`
   * 404s them - one listed here would link to an order page that says it does
   * not exist.
   */
  async listForCustomer(customerId: string, query: PaginationDto) {
    const where: Prisma.OrderWhereInput = { customerId, placedAt: { not: null } };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: publicOrderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return paginate(rows.map(toPublicOrder), total, query);
  }

  async list(query: ListOrdersDto) {
    const where: Prisma.OrderWhereInput = {
      status: query.status,
      customer: query.email ? { email: query.email.trim().toLowerCase() } : undefined,
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: publicOrderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return paginate(rows.map(toPublicOrder), total, query as PaginationDto);
  }

  /**
   * The legacy back-office route. It goes through the same workflow as
   * everything else - a transaction, the actor on the event, tracking before
   * SHIPPED - with one concession: re-sending the current status, which is how
   * the old admin attached a note, still works and becomes an internal note.
   */
  async updateStatus(number: string, dto: UpdateOrderStatusDto, actor: WorkflowActor) {
    await this.workflow.changeStatus(number, dto, actor, { allowSame: true });
    // staff asked, so a draft they just noted is answered rather than 404ed
    return toPublicOrder(await this.load(number));
  }
}

/**
 * The customer's view of an order: the storefront's order page, the shopper's
 * own list, and the legacy back-office routes. Pure and exported so its spec can
 * sit beside the admin mapper's - this one must never carry a NOTE, an actor or
 * anything else from the back office, whatever the row it is handed includes.
 */
export function toPublicOrder(o: PublicOrderRow) {
  return {
    number: o.number,
    status: o.status,
    currency: o.currency,
    customer: { email: o.customer.email, name: o.customer.name },
    items: o.items.map((i) => ({
      productSlug: i.product.slug,
      productName: i.product.name,
      color: { slug: i.color.slug, name: i.color.name, hex: i.color.hex },
      method: i.method,
      designId: i.design?.publicId ?? null,
      unitPrice: num(i.unitPrice),
      quantity: i.quantity,
      lineTotal: num(i.lineTotal),
      sizes: i.sizes.map((s) => ({
        size: s.size,
        qty: s.quantity,
        upcharge: num(s.upcharge),
      })),
    })),
    subtotal: num(o.subtotal),
    discount: num(o.discount),
    shipping: num(o.shipping),
    tax: num(o.tax),
    total: num(o.total),
    shippingAddress: {
      name: o.shipName,
      line1: o.shipLine1,
      line2: o.shipLine2,
      city: o.shipCity,
      state: o.shipState,
      postal: o.shipPostal,
      country: o.shipCountry,
    },
    tracking: toTracking(o),
    notes: o.notes,
    // never the actor: who in the back office did something is not the
    // customer's business
    timeline: o.events
      .filter((e) => PUBLIC_ORDER_EVENT_KINDS.includes(e.kind))
      .map((e) => ({
        kind: e.kind,
        status: e.status,
        note: e.note,
        at: e.createdAt,
      })),
    placedAt: o.placedAt,
    createdAt: o.createdAt,
  };
}
