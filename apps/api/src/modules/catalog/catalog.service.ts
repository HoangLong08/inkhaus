import { Injectable, NotFoundException } from '@nestjs/common';
import type { GarmentType, PrintMethod } from '@prisma/client';

import { num } from '../../common/decimal';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  METHOD_TO_LABEL,
  toColorway,
  toProductDto,
  productInclude,
  type ProductDto,
} from './catalog.mapper';
import type { ListProductsDto } from './dto/list-products.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(query: ListProductsDto): Promise<ProductDto[]> {
    const products = await this.prisma.product.findMany({
      where: {
        active: query.includeInactive ? undefined : true,
        type: query.type as GarmentType | undefined,
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' as const } },
                { blurb: { contains: query.q, mode: 'insensitive' as const } },
                { fabric: { contains: query.q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: productInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: query.limit,
    });

    return products.map(toProductDto);
  }

  async getProduct(slug: string): Promise<ProductDto> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: productInclude,
    });
    if (!product || !product.active) {
      throw new NotFoundException(`No product with slug "${slug}"`);
    }
    return toProductDto(product);
  }

  /** the raw row - internal callers (pricing, orders) need ids and Decimals */
  async requireProductRow(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: productInclude,
    });
    if (!product || !product.active) {
      throw new NotFoundException(`No product with slug "${slug}"`);
    }
    return product;
  }

  async listColors() {
    const colors = await this.prisma.color.findMany({ orderBy: { sortOrder: 'asc' } });
    return colors.map((c) => ({ id: c.id, slug: c.slug, ...toColorway(c) }));
  }

  async listSizes() {
    const sizes = await this.prisma.size.findMany({ orderBy: { sortOrder: 'asc' } });
    return sizes.map((s) => ({
      code: s.code,
      label: s.label,
      upcharge: num(s.upcharge),
    }));
  }

  async listTiers() {
    const tiers = await this.prisma.priceTier.findMany({ orderBy: { minQty: 'asc' } });
    return tiers.map((t) => ({ min: t.minQty, off: num(t.discount) }));
  }

  /**
   * The print methods actually stocked right now. Both halves are returned because
   * the storefront renders `label` but `POST /orders` takes the enum `value`.
   */
  async listMethods() {
    const rows = await this.prisma.product.findMany({
      where: { active: true },
      select: { methods: true },
    });
    const stocked = new Set(rows.flatMap((r) => r.methods));
    return (Object.keys(METHOD_TO_LABEL) as PrintMethod[])
      .filter((m) => stocked.has(m))
      .map((m) => ({ value: m, label: METHOD_TO_LABEL[m] }));
  }
}
