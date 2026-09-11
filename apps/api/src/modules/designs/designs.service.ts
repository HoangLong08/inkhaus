import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { customAlphabet } from 'nanoid';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { CustomersService } from '../customers/customers.service';
import type { CreateDesignDto } from './dto/create-design.dto';
import type { UpdateDesignDto } from './dto/update-design.dto';

/** url-safe, no lookalike characters - these end up in shareable links */
const publicId = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 10);

@Injectable()
export class DesignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly customers: CustomersService,
  ) {}

  async create(dto: CreateDesignDto) {
    const product = await this.catalog.requireProductRow(dto.productSlug);
    const colorId = await this.resolveColor(product.id, dto.colorSlug);
    const customer = dto.email ? await this.customers.findOrCreate(dto.email) : null;

    const design = await this.prisma.design.create({
      data: {
        publicId: publicId(),
        name: dto.name ?? 'Untitled design',
        productId: product.id,
        colorId,
        scene: dto.scene as Prisma.InputJsonValue,
        previewFront: dto.previewFront,
        previewBack: dto.previewBack,
        customerId: customer?.id,
      },
      include: { product: true, color: true },
    });

    return this.toDto(design);
  }

  async findByPublicId(id: string) {
    const design = await this.prisma.design.findUnique({
      where: { publicId: id },
      include: { product: true, color: true },
    });
    if (!design) throw new NotFoundException(`No design "${id}"`);
    return this.toDto(design);
  }

  /**
   * What the back office needs to draw a design: its name and the two mockup
   * previews. Never the scene - that is the studio's working file, it can run to
   * megabytes, and nothing in the back office edits it.
   */
  async preview(publicId: string) {
    const design = await this.prisma.design.findUnique({
      where: { publicId },
      select: {
        publicId: true,
        name: true,
        previewFront: true,
        previewBack: true,
        product: { select: { slug: true } },
        color: { select: { hex: true } },
      },
    });
    if (!design) throw new NotFoundException(`No design "${publicId}"`);

    return {
      publicId: design.publicId,
      name: design.name,
      productSlug: design.product.slug,
      colorHex: design.color?.hex ?? null,
      previewFront: design.previewFront,
      previewBack: design.previewBack,
    };
  }

  async update(id: string, dto: UpdateDesignDto) {
    const existing = await this.prisma.design.findUnique({ where: { publicId: id } });
    if (!existing) throw new NotFoundException(`No design "${id}"`);

    const productId = dto.productSlug
      ? (await this.catalog.requireProductRow(dto.productSlug)).id
      : existing.productId;

    const design = await this.prisma.design.update({
      where: { publicId: id },
      data: {
        name: dto.name,
        productId,
        colorId:
          dto.colorSlug === undefined
            ? undefined
            : await this.resolveColor(productId, dto.colorSlug),
        scene: dto.scene ? (dto.scene as Prisma.InputJsonValue) : undefined,
        previewFront: dto.previewFront,
        previewBack: dto.previewBack,
      },
      include: { product: true, color: true },
    });

    return this.toDto(design);
  }

  async remove(id: string) {
    await this.prisma.design.delete({ where: { publicId: id } });
    return { deleted: true, publicId: id };
  }

  async listForCustomer(email: string) {
    const designs = await this.prisma.design.findMany({
      where: { customer: { email: email.trim().toLowerCase() } },
      include: { product: true, color: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return designs.map((d) => this.toDto(d));
  }

  /** a colour is only valid for a product if the product actually stocks it */
  private async resolveColor(productId: string, slug?: string) {
    if (!slug) return null;
    const link = await this.prisma.productColor.findFirst({
      where: { productId, color: { slug } },
      select: { colorId: true },
    });
    if (!link) throw new NotFoundException(`Colour "${slug}" is not stocked for this blank`);
    return link.colorId;
  }

  private toDto(
    d: Prisma.DesignGetPayload<{ include: { product: true; color: true } }>,
  ) {
    return {
      publicId: d.publicId,
      name: d.name,
      productSlug: d.product.slug,
      productName: d.product.name,
      colorSlug: d.color?.slug ?? null,
      colorHex: d.color?.hex ?? null,
      scene: d.scene,
      previewFront: d.previewFront,
      previewBack: d.previewBack,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }
}
