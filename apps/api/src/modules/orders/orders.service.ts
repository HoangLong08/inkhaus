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

const orderInclude = {
  customer: true,
  items: { include: { product: true, color: true, design: true, sizes: true } },
  // Staff notes never leave the back office (decision D3), so this DTO does not
  // even load them. `toDto` filters again: it is the last line, and a caller
  // with its own include should not be able to leak one.
  events: {
    where: { kind: { in: [...PUBLIC_ORDER_EVENT_KINDS] } },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

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
      return tx.order.findUniqueOrThrow({ where: { id: created.id }, include: orderInclude });
    });

    return this.toDto(order);
  }

  async findByNumber(number: string) {
    const order = await this.prisma.order.findUnique({
      where: { number },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException(`No order "${number}"`);
    return this.toDto(order);
  }

  /**
   * Every order belonging to the signed-in shopper, newest first.
   *
   * Scoped by `customerId` from the session and never by anything in the
   * request, which is what separates this from `list()` below: there is no
   * parameter here a caller could bend into someone else's history.
   */
  async listForCustomer(customerId: string, query: PaginationDto) {
    const where: Prisma.OrderWhereInput = { customerId };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return paginate(rows.map((r) => this.toDto(r)), total, query);
  }

  async list(query: ListOrdersDto) {
    const where: Prisma.OrderWhereInput = {
      status: query.status,
      customer: query.email ? { email: query.email.trim().toLowerCase() } : undefined,
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return paginate(rows.map((r) => this.toDto(r)), total, query as PaginationDto);
  }

  /**
   * The legacy back-office route. It goes through the same workflow as
   * everything else - a transaction, the actor on the event, tracking before
   * SHIPPED - with one concession: re-sending the current status, which is how
   * the old admin attached a note, still works and becomes an internal note.
   */
  async updateStatus(number: string, dto: UpdateOrderStatusDto, actor: WorkflowActor) {
    await this.workflow.changeStatus(number, dto, actor, { allowSame: true });
    return this.findByNumber(number);
  }

  private toDto(o: OrderRow) {
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
}
