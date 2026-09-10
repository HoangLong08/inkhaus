import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { unitPrice } from '@inkhaus/shared';

import { num, round2 } from '../../common/decimal';
import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { CustomersService } from '../customers/customers.service';
import { PricingService } from '../pricing/pricing.service';
import type { CreateBulkQuoteDto } from './dto/create-quote.dto';
import type { ListBulkQuotesDto } from './dto/list-quotes.dto';
import type { UpdateBulkQuoteDto } from './dto/update-quote.dto';
import { QuoteWorkflowService, type QuoteActor } from './quote-workflow.service';

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly pricing: PricingService,
    private readonly customers: CustomersService,
    private readonly workflow: QuoteWorkflowService,
  ) {}

  /** the /bulk calculator lead form - snapshots the price it was quoted at */
  async create(dto: CreateBulkQuoteDto) {
    const product = dto.productSlug
      ? await this.catalog.requireProductRow(dto.productSlug)
      : null;
    const customer = await this.customers.findOrCreate(dto.email, {
      name: dto.name,
      company: dto.company,
    });

    let estimated: number | null = null;
    if (product) {
      const { tiers } = await this.pricing.ladder();
      const per = unitPrice(
        { price: num(product.price), bulkPrice: num(product.bulkPrice) },
        dto.quantity,
        tiers,
      );
      estimated = round2(per * dto.quantity);
    }

    const quote = await this.prisma.bulkQuote.create({
      data: {
        email: customer.email,
        name: dto.name,
        company: dto.company,
        productId: product?.id,
        quantity: dto.quantity,
        method: dto.method,
        message: dto.message,
        estimated: estimated === null ? null : new Prisma.Decimal(estimated),
        customerId: customer.id,
      },
      include: { product: true },
    });

    return this.toDto(quote);
  }

  async list(query: ListBulkQuotesDto) {
    const where: Prisma.BulkQuoteWhereInput = { status: query.status };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.bulkQuote.findMany({
        where,
        include: { product: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.bulkQuote.count({ where }),
    ]);
    return paginate(rows.map((r) => this.toDto(r)), total, query);
  }

  /**
   * The legacy back-office PATCH. `message` used to overwrite what the customer
   * wrote; it is now a staff note on the quote's history, and the customer's
   * words stay put. The response shape is unchanged.
   */
  async update(id: string, dto: UpdateBulkQuoteDto, actor: QuoteActor) {
    await this.workflow.setStatus(id, dto.status, actor);

    const note = dto.message?.trim();
    if (note) await this.workflow.addNote(id, note, actor);

    const quote = await this.prisma.bulkQuote.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!quote) throw new NotFoundException(`No quote "${id}"`);
    return this.toDto(quote);
  }

  private toDto(q: Prisma.BulkQuoteGetPayload<{ include: { product: true } }>) {
    return {
      id: q.id,
      email: q.email,
      name: q.name,
      company: q.company,
      productSlug: q.product?.slug ?? null,
      quantity: q.quantity,
      method: q.method,
      message: q.message,
      estimated: q.estimated === null ? null : num(q.estimated),
      status: q.status,
      createdAt: q.createdAt,
    };
  }
}
