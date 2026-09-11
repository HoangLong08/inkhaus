import { Injectable, NotFoundException } from '@nestjs/common';
import type { GarmentType, PrintMethod } from '@prisma/client';
import { SIZES, type Tier } from '@inkhaus/shared';

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

export type PriceLadder = { tiers: Tier[]; upcharges: Record<string, number> };

/** GET /admin/catalog/options, minus the price-edit flag - the admin app parses exactly this */
export type CatalogOptions = {
  products: {
    slug: string;
    name: string;
    /** the single-unit list price, USD */
    price: number;
    /** the floor no tier discount goes below, USD */
    bulkPrice: number;
    methods: PrintMethod[];
    /** the size run it stocks - the product's own, or the default apparel run */
    sizes: string[];
    /** active colours only, in the product's own order */
    colors: { slug: string; name: string; hex: string }[];
  }[];
  ladder: PriceLadder;
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The storefront's product grid - active blanks only. There used to be an
   * `includeInactive` switch here for the back office; it was public, so anyone
   * could list archived blanks. The admin has its own endpoints now.
   */
  async listProducts(query: ListProductsDto): Promise<ProductDto[]> {
    const products = await this.prisma.product.findMany({
      where: {
        active: true,
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

  /** tiers and size upcharges straight from the database - what every price is computed from */
  async ladder(): Promise<PriceLadder> {
    const [tiers, sizes] = await Promise.all([this.listTiers(), this.listSizes()]);
    return {
      tiers,
      upcharges: Object.fromEntries(sizes.map((s) => [s.code, s.upcharge])),
    };
  }

  /**
   * What a back-office form needs to build an order line or preview a price:
   * every product on sale, with its prices and the methods, sizes and colours
   * it can be ordered in, plus the ladder to price it with - everything the
   * shared `quote()` needs to estimate before anything is submitted. Archived
   * products are left out because checkout refuses them; archived colours
   * because nothing new may be made in one.
   */
  async adminOptions(): Promise<CatalogOptions> {
    const [rows, ladder] = await Promise.all([
      this.prisma.product.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          slug: true,
          name: true,
          price: true,
          bulkPrice: true,
          methods: true,
          sizes: true,
          colors: {
            where: { color: { active: true } },
            orderBy: { sortOrder: 'asc' },
            select: { color: { select: { slug: true, name: true, hex: true } } },
          },
        },
      }),
      this.ladder(),
    ]);

    return {
      products: rows.map((p) => ({
        slug: p.slug,
        name: p.name,
        price: num(p.price),
        bulkPrice: num(p.bulkPrice),
        methods: p.methods,
        // the same fallback as `sizesFor` in @inkhaus/shared: empty means the
        // apparel run
        sizes: p.sizes.length ? p.sizes : [...SIZES],
        colors: p.colors.map(({ color }) => color),
      })),
      ladder,
    };
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
