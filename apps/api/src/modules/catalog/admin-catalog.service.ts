import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type AdminUser, type PrintMethod } from '@prisma/client';
import {
  PRINT_METHODS,
  type GarmentType as GarmentTypeLiteral,
  type ProductSort,
} from '@inkhaus/shared';

import { AuditService, type AuditRecord } from '../../common/audit/audit.service';
import { num } from '../../common/decimal';
import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { bulkPriceError, changedFields, priceFieldError, touchesPrice } from './admin-catalog.rules';
import { GARMENT_TYPE_TO_SLUG, SLUG_TO_GARMENT_TYPE } from './catalog.mapper';
import type { AdminListProductsDto } from './dto/admin-list-products.dto';
import type { AdminCreateProductDto, AdminUpdateProductDto } from './dto/admin-product.dto';
import { PriceEditsPolicy } from './price-edits.policy';

/** one row of GET /admin/catalog/products - the admin app parses exactly this */
export type AdminProductListItem = {
  slug: string;
  name: string;
  type: GarmentTypeLiteral;
  category: string;
  price: number;
  bulkPrice: number;
  active: boolean;
  sortOrder: number;
  methods: PrintMethod[];
  colorCount: number;
  /** distinct orders with a line for this product */
  orderCount: number;
  updatedAt: string;
};

/** GET /admin/catalog/products/:slug */
export type AdminProductDetail = Omit<AdminProductListItem, 'colorCount'> & {
  blurb: string;
  fabric: string;
  tag: string | null;
  /** the raw run; empty means the default apparel run */
  sizes: string[];
  printArea: { x: number; y: number; w: number; h: number };
  printInches: { w: number; h: number };
  createdAt: string;
  /** in the product's own order - the first is the storefront's default */
  colors: { slug: string; name: string; hex: string; dark: boolean; active: boolean }[];
  /** read-only here: photography is managed in the repository (D15) */
  images: {
    src: string;
    src2x: string | null;
    alt: string;
    width: number;
    height: number;
    color: string | null;
  }[];
  history: AuditRecord[];
};

const detailInclude = {
  colors: { include: { color: true }, orderBy: { sortOrder: 'asc' } },
  images: { include: { color: { select: { slug: true } } }, orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof detailInclude }>;

const listSelect = {
  id: true,
  slug: true,
  name: true,
  type: true,
  category: true,
  price: true,
  bulkPrice: true,
  active: true,
  sortOrder: true,
  methods: true,
  updatedAt: true,
  _count: { select: { colors: true } },
} satisfies Prisma.ProductSelect;

/** every sort ends on a unique-ish key, so a page boundary never reshuffles */
const ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  sort_asc: [{ sortOrder: 'asc' }, { name: 'asc' }, { slug: 'asc' }],
  name_asc: [{ name: 'asc' }, { slug: 'asc' }],
  price_asc: [{ price: 'asc' }, { name: 'asc' }, { slug: 'asc' }],
  price_desc: [{ price: 'desc' }, { name: 'asc' }, { slug: 'asc' }],
  updated_desc: [{ updatedAt: 'desc' }, { slug: 'asc' }],
};

/** the audited shape of a product - what a history entry compares */
type ProductSnapshot = Record<string, unknown>;

/** print methods in the shared table's order, so the same set always compares equal */
const canonicalMethods = (methods: readonly PrintMethod[]) =>
  PRINT_METHODS.filter((m) => methods.includes(m));

/**
 * Products in the back office. Price fields need `catalog.price` and an open
 * PriceEditsPolicy; everything else is `catalog.edit`. Every change is audited,
 * in the same transaction as the change itself.
 */
@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly priceEdits: PriceEditsPolicy,
  ) {}

  async list(query: AdminListProductsDto): Promise<Paginated<AdminProductListItem>> {
    const where: Prisma.ProductWhereInput = {
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.type ? { type: SLUG_TO_GARMENT_TYPE[query.type] } : {}),
      ...(query.active === 'active' ? { active: true } : {}),
      ...(query.active === 'archived' ? { active: false } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: listSelect,
        orderBy: ORDER_BY[query.sort],
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    const orders = await this.orderCounts(rows.map((r) => r.id));
    return paginate(
      rows.map((p) => ({
        slug: p.slug,
        name: p.name,
        type: GARMENT_TYPE_TO_SLUG[p.type],
        category: p.category,
        price: num(p.price),
        bulkPrice: num(p.bulkPrice),
        active: p.active,
        sortOrder: p.sortOrder,
        methods: canonicalMethods(p.methods),
        colorCount: p._count.colors,
        orderCount: orders.get(p.id) ?? 0,
        updatedAt: p.updatedAt.toISOString(),
      })),
      total,
      query,
    );
  }

  async detail(slug: string): Promise<AdminProductDetail> {
    const product = await this.prisma.product.findUnique({ where: { slug }, include: detailInclude });
    if (!product) throw new NotFoundException(`No product with slug "${slug}".`);

    const [orders, history] = await Promise.all([
      this.orderCounts([product.id]),
      this.audit.history('product', product.id, 10),
    ]);
    return toDetail(product, orders.get(product.id) ?? 0, history);
  }

  /**
   * A new blank. `catalog.create` (owners) is the route's floor; the flag is
   * checked here because a new blank carries a price.
   */
  async create(admin: AdminUser, dto: AdminCreateProductDto): Promise<AdminProductDetail> {
    this.priceEdits.assertEnabled();
    assertValid(bulkPriceError(dto));

    await this.prisma.$transaction(async (tx) => {
      const taken = await tx.product.findUnique({ where: { slug: dto.slug }, select: { id: true } });
      if (taken) throw new ConflictException(`A product with the slug "${dto.slug}" already exists.`);

      const sizes = await resolveSizes(tx, dto.sizes);
      const colors = await resolveColors(tx, dto.colorSlugs, new Set());

      const product = await tx.product.create({
        data: {
          slug: dto.slug,
          name: dto.name,
          type: SLUG_TO_GARMENT_TYPE[dto.type],
          category: dto.category,
          blurb: dto.blurb,
          fabric: dto.fabric,
          tag: dto.tag || null,
          sizes,
          price: dto.price,
          bulkPrice: dto.bulkPrice,
          methods: canonicalMethods(dto.methods),
          printAreaX: dto.printArea.x,
          printAreaY: dto.printArea.y,
          printAreaW: dto.printArea.w,
          printAreaH: dto.printArea.h,
          printInchesW: dto.printInches.w,
          printInchesH: dto.printInches.h,
          active: dto.active,
          sortOrder: dto.sortOrder,
          colors: { create: colors.map((c, sortOrder) => ({ colorId: c.id, sortOrder })) },
        },
        include: detailInclude,
      });

      await this.audit.record(tx, {
        actorId: admin.id,
        action: 'product.create',
        entity: 'product',
        entityId: product.id,
        summary: `Created ${product.name}`,
        after: snapshot(product),
      });
    });

    return this.detail(dto.slug);
  }

  /**
   * Any subset of the fields. A body carrying a price needs an owner (403) AND
   * open price edits (409) - in that order, so staff are told it is not theirs
   * to change rather than that it is switched off. Colours are replaced in the
   * same transaction as the rest, so a product is never saved half-coloured.
   */
  async update(
    admin: AdminUser,
    slug: string,
    dto: AdminUpdateProductDto,
  ): Promise<AdminProductDetail> {
    const refused = priceFieldError(admin.role, dto);
    if (refused) throw new ForbiddenException(refused);
    if (touchesPrice(dto)) this.priceEdits.assertEnabled();

    await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { slug }, include: detailInclude });
      if (!product) throw new NotFoundException(`No product with slug "${slug}".`);

      const before = snapshot(product);
      assertValid(
        bulkPriceError({ price: num(product.price), bulkPrice: num(product.bulkPrice) }, dto),
      );

      const sizes = dto.sizes ? await resolveSizes(tx, dto.sizes) : undefined;
      const linked = new Set(product.colors.map(({ color }) => color.slug));
      const colors = dto.colorSlugs ? await resolveColors(tx, dto.colorSlugs, linked) : undefined;

      const after: ProductSnapshot = {
        ...before,
        ...defined({
          name: dto.name,
          type: dto.type,
          category: dto.category,
          blurb: dto.blurb,
          fabric: dto.fabric,
          price: dto.price,
          bulkPrice: dto.bulkPrice,
          active: dto.active,
          sortOrder: dto.sortOrder,
        }),
        ...(dto.tag !== undefined ? { tag: dto.tag || null } : {}),
        ...(dto.methods ? { methods: canonicalMethods(dto.methods) } : {}),
        ...(sizes ? { sizes } : {}),
        // key order spelled out: the diff compares JSON, and a body may list
        // them in any order
        ...(dto.printArea
          ? {
              printArea: {
                x: dto.printArea.x,
                y: dto.printArea.y,
                w: dto.printArea.w,
                h: dto.printArea.h,
              },
            }
          : {}),
        ...(dto.printInches ? { printInches: { w: dto.printInches.w, h: dto.printInches.h } } : {}),
        ...(colors ? { colorSlugs: colors.map((c) => c.slug) } : {}),
      };

      const diff = changedFields(before, after);
      const changed = Object.keys(diff.after);
      // a save that changes nothing writes nothing - no bumped updatedAt, no
      // empty entry in the history card
      if (changed.length === 0) return;

      await tx.product.update({
        where: { id: product.id },
        data: {
          ...defined({
            name: dto.name,
            category: dto.category,
            blurb: dto.blurb,
            fabric: dto.fabric,
            price: dto.price,
            bulkPrice: dto.bulkPrice,
            active: dto.active,
            sortOrder: dto.sortOrder,
          }),
          ...(dto.type ? { type: SLUG_TO_GARMENT_TYPE[dto.type] } : {}),
          ...(dto.tag !== undefined ? { tag: dto.tag || null } : {}),
          ...(dto.methods ? { methods: canonicalMethods(dto.methods) } : {}),
          ...(sizes ? { sizes } : {}),
          ...(dto.printArea
            ? {
                printAreaX: dto.printArea.x,
                printAreaY: dto.printArea.y,
                printAreaW: dto.printArea.w,
                printAreaH: dto.printArea.h,
              }
            : {}),
          ...(dto.printInches
            ? { printInchesW: dto.printInches.w, printInchesH: dto.printInches.h }
            : {}),
          // explicit, because a colour-only change touches no product column
          // and @updatedAt would otherwise stay put
          updatedAt: new Date(),
        },
      });

      if (colors && 'colorSlugs' in diff.after) {
        await tx.productColor.deleteMany({ where: { productId: product.id } });
        await tx.productColor.createMany({
          data: colors.map((c, sortOrder) => ({ productId: product.id, colorId: c.id, sortOrder })),
        });
      }

      await this.audit.record(tx, {
        actorId: admin.id,
        action: 'product.update',
        entity: 'product',
        entityId: product.id,
        summary: `Changed ${changed.join(', ')}`,
        before: diff.before,
        after: diff.after,
      });
    });

    return this.detail(slug);
  }

  /**
   * Distinct orders per product, in one query. `_count.orderItems` would count
   * lines, and an order with the same blank in two colours is still one order.
   */
  private async orderCounts(productIds: string[]): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();
    const rows = await this.prisma.$queryRaw<{ productId: string; orders: bigint }[]>`
      SELECT "productId", COUNT(DISTINCT "orderId") AS orders
      FROM "order_items"
      WHERE "productId" IN (${Prisma.join(productIds)})
      GROUP BY "productId"`;
    return new Map(rows.map((r) => [r.productId, Number(r.orders)]));
  }
}

type Tx = Prisma.TransactionClient;

function assertValid(message: string | null) {
  if (message) throw new BadRequestException(message);
}

/** the keys whose value is not undefined - a PATCH body's "fields that were sent" */
function defined<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/**
 * The codes, in the sizes table's order - which is the order the storefront's
 * size picker shows them in, whatever order the form sent.
 */
async function resolveSizes(tx: Tx, codes: string[]): Promise<string[]> {
  if (codes.length === 0) return [];
  const rows = await tx.size.findMany({
    where: { code: { in: codes } },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    select: { code: true },
  });
  const known = new Set(rows.map((r) => r.code));
  const missing = codes.filter((c) => !known.has(c));
  if (missing.length) {
    throw new BadRequestException(
      `No size ${missing.join(', ')} - add it on the sizes page before stocking it.`,
    );
  }
  return rows.map((r) => r.code);
}

/**
 * The colours, in the order given. An archived colour may stay on a product
 * that already has it (D11) but cannot be added to one.
 */
async function resolveColors(tx: Tx, slugs: string[], linked: Set<string>) {
  const rows = await tx.color.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, name: true, active: true },
  });
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  const missing = slugs.filter((s) => !bySlug.has(s));
  if (missing.length) {
    throw new BadRequestException(`No colour with the slug ${missing.map((s) => `"${s}"`).join(', ')}.`);
  }

  const archived = slugs.map((s) => bySlug.get(s)!).filter((c) => !c.active && !linked.has(c.slug));
  if (archived.length) {
    const names = archived.map((c) => c.name).join(', ');
    throw new BadRequestException(
      `${names} ${archived.length === 1 ? 'is' : 'are'} archived and cannot be added to a product.`,
    );
  }

  return slugs.map((s) => bySlug.get(s)!);
}

/** the fields a history entry compares, in the admin's own vocabulary */
function snapshot(p: ProductRow): ProductSnapshot {
  return {
    name: p.name,
    type: GARMENT_TYPE_TO_SLUG[p.type],
    category: p.category,
    blurb: p.blurb,
    fabric: p.fabric,
    tag: p.tag,
    sizes: p.sizes,
    price: num(p.price),
    bulkPrice: num(p.bulkPrice),
    methods: canonicalMethods(p.methods),
    printArea: { x: p.printAreaX, y: p.printAreaY, w: p.printAreaW, h: p.printAreaH },
    printInches: { w: num(p.printInchesW), h: num(p.printInchesH) },
    colorSlugs: p.colors.map(({ color }) => color.slug),
    active: p.active,
    sortOrder: p.sortOrder,
  };
}

function toDetail(p: ProductRow, orderCount: number, history: AuditRecord[]): AdminProductDetail {
  return {
    slug: p.slug,
    name: p.name,
    type: GARMENT_TYPE_TO_SLUG[p.type],
    category: p.category,
    blurb: p.blurb,
    fabric: p.fabric,
    tag: p.tag,
    sizes: p.sizes,
    price: num(p.price),
    bulkPrice: num(p.bulkPrice),
    methods: canonicalMethods(p.methods),
    printArea: { x: p.printAreaX, y: p.printAreaY, w: p.printAreaW, h: p.printAreaH },
    printInches: { w: num(p.printInchesW), h: num(p.printInchesH) },
    active: p.active,
    sortOrder: p.sortOrder,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    colors: p.colors.map(({ color }) => ({
      slug: color.slug,
      name: color.name,
      hex: color.hex,
      dark: color.dark,
      active: color.active,
    })),
    images: p.images.map((i) => ({
      src: i.src,
      src2x: i.src2x,
      alt: i.alt,
      width: i.width,
      height: i.height,
      color: i.color?.slug ?? null,
    })),
    orderCount,
    history,
  };
}
