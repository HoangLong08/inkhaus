import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole, OrderStatus, Prisma } from '@prisma/client';
import { canSetStatus, canTransition, quote as computeQuote } from '@inkhaus/shared';

import { num, round2 } from '../../common/decimal';
import { paginate, type PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { CustomersService } from '../customers/customers.service';
import { PricingService } from '../pricing/pricing.service';
import type { CreateOrderDto, OrderItemDto } from './dto/create-order.dto';
import type { ListOrdersDto } from './dto/list-orders.dto';
import type { UpdateOrderStatusDto } from './dto/update-order-status.dto';

const orderInclude = {
  customer: true,
  items: { include: { product: true, color: true, design: true, sizes: true } },
  events: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly pricing: PricingService,
    private readonly customers: CustomersService,
  ) {}

  /**
   * Prices every line from the database and writes the order in one transaction.
   * Nothing the client sends about money is trusted - only slugs and quantities.
   */
  async create(dto: CreateOrderDto) {
    const customer = await this.customers.findOrCreate(dto.customer.email, {
      name: dto.customer.name,
      phone: dto.customer.phone,
      company: dto.customer.company,
    });
    const { tiers, upcharges } = await this.pricing.ladder();

    const priced = await Promise.all(
      dto.items.map((item) => this.priceItem(item, tiers, upcharges)),
    );

    const subtotal = round2(priced.reduce((s, p) => s + p.lineTotal, 0));
    const totals = this.pricing.totals(subtotal);

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          // replaced below once the sequence hands us a number
          number: `pending-${customer.id}-${Date.now()}`,
          status: OrderStatus.PENDING_PAYMENT,
          customerId: customer.id,
          subtotal: new Prisma.Decimal(totals.subtotal),
          shipping: new Prisma.Decimal(totals.shipping),
          tax: new Prisma.Decimal(totals.tax),
          total: new Prisma.Decimal(totals.total),
          shipName: dto.shipping?.name,
          shipLine1: dto.shipping?.line1,
          shipLine2: dto.shipping?.line2,
          shipCity: dto.shipping?.city,
          shipState: dto.shipping?.state,
          shipPostal: dto.shipping?.postal,
          shipCountry: dto.shipping?.country ?? 'US',
          notes: dto.notes,
          placedAt: new Date(),
          items: {
            create: priced.map((p) => ({
              productId: p.productId,
              colorId: p.colorId,
              designId: p.designId,
              method: p.method,
              unitPrice: new Prisma.Decimal(p.unitPrice),
              quantity: p.quantity,
              lineTotal: new Prisma.Decimal(p.lineTotal),
              sizes: {
                create: p.sizes.map((s) => ({
                  size: s.size,
                  quantity: s.qty,
                  upcharge: new Prisma.Decimal(s.upcharge),
                })),
              },
            })),
          },
          events: {
            create: { status: OrderStatus.PENDING_PAYMENT, note: 'Order placed' },
          },
        },
      });

      return tx.order.update({
        where: { id: created.id },
        data: { number: `INK-${String(created.seq).padStart(6, '0')}` },
        include: orderInclude,
      });
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

  async updateStatus(number: string, dto: UpdateOrderStatusDto, role: AdminRole) {
    const current = await this.prisma.order.findUnique({ where: { number } });
    if (!current) throw new NotFoundException(`No order "${number}"`);

    // Cancelling and refunding move money, so they are owner-only. Checked
    // before the transition table so staff get "you may not" rather than a
    // confusing "cannot move from X to Y".
    if (!canSetStatus(role, dto.status)) {
      throw new ForbiddenException(
        `Only an owner can move an order to ${dto.status}`,
      );
    }

    // the same table the admin app builds its dropdown from, so the two cannot
    // disagree about what is a legal move
    if (!canTransition(current.status, dto.status)) {
      throw new BadRequestException(
        `Cannot move an order from ${current.status} to ${dto.status}`,
      );
    }

    const order = await this.prisma.order.update({
      where: { number },
      data: {
        status: dto.status,
        events: { create: { status: dto.status, note: dto.note } },
      },
      include: orderInclude,
    });

    return this.toDto(order);
  }

  /** resolve slugs to ids and recompute the line price from the live ladder */
  private async priceItem(
    item: OrderItemDto,
    tiers: { min: number; off: number }[],
    upcharges: Record<string, number>,
  ) {
    const product = await this.catalog.requireProductRow(item.productSlug);

    if (!product.methods.includes(item.method)) {
      throw new BadRequestException(
        `${product.name} cannot be printed with ${item.method}`,
      );
    }

    const link = product.colors.find((c) => c.color.slug === item.colorSlug);
    if (!link) {
      throw new BadRequestException(
        `${product.name} is not stocked in "${item.colorSlug}"`,
      );
    }

    const unknown = item.sizes.filter((s) => !(s.size in upcharges));
    if (unknown.length) {
      throw new BadRequestException(`Unknown size(s): ${unknown.map((s) => s.size).join(', ')}`);
    }

    let designId: string | undefined;
    if (item.designId) {
      const design = await this.prisma.design.findUnique({
        where: { publicId: item.designId },
        select: { id: true, productId: true },
      });
      if (!design) throw new NotFoundException(`No design "${item.designId}"`);
      if (design.productId !== product.id) {
        throw new BadRequestException('That design was made for a different blank');
      }
      designId = design.id;
    }

    const q = computeQuote(
      { price: num(product.price), bulkPrice: num(product.bulkPrice) },
      item.sizes,
      { tiers, upcharges },
    );

    return {
      productId: product.id,
      colorId: link.colorId,
      designId,
      method: item.method,
      unitPrice: q.baseUnitPrice,
      quantity: q.quantity,
      lineTotal: q.subtotal,
      sizes: q.lines,
    };
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
      notes: o.notes,
      timeline: o.events.map((e) => ({
        status: e.status,
        note: e.note,
        at: e.createdAt,
      })),
      placedAt: o.placedAt,
      createdAt: o.createdAt,
    };
  }
}
