import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AdminUser } from '@prisma/client';
import { can, validateTiers } from '@inkhaus/shared';

import { AuditService } from '../../common/audit/audit.service';
import { num } from '../../common/decimal';
import { PrismaService } from '../../common/prisma/prisma.service';
import { changedFields, countStocking, isBuiltInSize, sizeDeleteError } from './admin-catalog.rules';
import type {
  AdminCreateColorDto,
  AdminCreateSizeDto,
  AdminReplaceTiersDto,
  AdminUpdateColorDto,
  AdminUpdateSizeDto,
} from './dto/admin-catalog-settings.dto';
import { PriceEditsPolicy } from './price-edits.policy';

/** GET /admin/catalog/colors - one row */
export type AdminColor = {
  slug: string;
  name: string;
  hex: string;
  dark: boolean;
  active: boolean;
  sortOrder: number;
  productCount: number;
  orderItemCount: number;
};

/** GET /admin/catalog/sizes - one row */
export type AdminSize = {
  code: string;
  label: string;
  upcharge: number;
  sortOrder: number;
  /** products whose run includes it; a product with no run of its own stocks the default run */
  productCount: number;
  /** in the default run or the one-size code - never deletable */
  builtIn: boolean;
};

/** GET and PUT /admin/catalog/price-tiers - the same shape both ways, so a read can be written back */
export type AdminTiers = { tiers: { minQty: number; discount: number }[] };

/** the one row the tier ladder's audit entries hang off */
const LADDER_ID = 'ladder';

const colorCount = { _count: { select: { products: true, orderItems: true } } } as const;

/**
 * Colours, sizes and the price-tier ladder. Upcharges and tiers are prices, so
 * they sit behind PriceEditsPolicy as well as `catalog.price`. Every write is
 * audited in the transaction that makes it.
 */
@Injectable()
export class AdminCatalogSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly priceEdits: PriceEditsPolicy,
  ) {}

  // ---------------------------------------------------------------- colours

  async colors(): Promise<AdminColor[]> {
    const rows = await this.prisma.color.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: colorCount,
    });
    return rows.map(toColor);
  }

  async createColor(admin: AdminUser, dto: AdminCreateColorDto): Promise<AdminColor> {
    return this.prisma.$transaction(async (tx) => {
      const taken = await tx.color.findUnique({ where: { slug: dto.slug }, select: { id: true } });
      if (taken) throw new ConflictException(`A colour with the slug "${dto.slug}" already exists.`);

      const color = await tx.color.create({
        data: {
          slug: dto.slug,
          name: dto.name,
          hex: dto.hex.toUpperCase(),
          dark: dto.dark ?? false,
          sortOrder: dto.sortOrder ?? 0,
        },
        include: colorCount,
      });
      await this.audit.record(tx, {
        actorId: admin.id,
        action: 'color.create',
        entity: 'color',
        entityId: color.id,
        summary: `Created ${color.name}`,
        after: colorSnapshot(color),
      });
      return toColor(color);
    });
  }

  /** archiving is `active: false` - a colour is never deleted, order lines point at it (D11) */
  async updateColor(admin: AdminUser, slug: string, dto: AdminUpdateColorDto): Promise<AdminColor> {
    return this.prisma.$transaction(async (tx) => {
      const color = await tx.color.findUnique({ where: { slug }, include: colorCount });
      if (!color) throw new NotFoundException(`No colour with slug "${slug}".`);

      const before = colorSnapshot(color);
      const diff = changedFields(before, {
        ...before,
        ...defined({
          name: dto.name,
          hex: dto.hex?.toUpperCase(),
          dark: dto.dark,
          sortOrder: dto.sortOrder,
          active: dto.active,
        }),
      });
      if (Object.keys(diff.after).length === 0) return toColor(color);

      const updated = await tx.color.update({
        where: { id: color.id },
        data: diff.after,
        include: colorCount,
      });
      await this.audit.record(tx, {
        actorId: admin.id,
        action: diff.after.active === false ? 'color.archive' : 'color.update',
        entity: 'color',
        entityId: color.id,
        summary: `Changed ${Object.keys(diff.after).join(', ')}`,
        before: diff.before,
        after: diff.after,
      });
      return toColor(updated);
    });
  }

  // ------------------------------------------------------------------ sizes

  async sizes(): Promise<AdminSize[]> {
    const [rows, runs] = await Promise.all([
      this.prisma.size.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
      this.productRuns(),
    ]);
    return rows.map((s) => toSize(s, runs));
  }

  /** a new code carries an upcharge, so it is a price decision like any other */
  async createSize(admin: AdminUser, dto: AdminCreateSizeDto): Promise<AdminSize> {
    this.priceEdits.assertEnabled();

    const size = await this.prisma.$transaction(async (tx) => {
      const taken = await tx.size.findUnique({ where: { code: dto.code }, select: { id: true } });
      if (taken) throw new ConflictException(`A size with the code "${dto.code}" already exists.`);

      const created = await tx.size.create({
        data: {
          code: dto.code,
          label: dto.label,
          upcharge: dto.upcharge,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      await this.audit.record(tx, {
        actorId: admin.id,
        action: 'size.create',
        entity: 'size',
        entityId: created.id,
        summary: `Created ${created.code}`,
        after: sizeSnapshot(created),
      });
      return created;
    });

    return toSize(size, await this.productRuns());
  }

  /**
   * Label and sort order are content (`catalog.edit`). An upcharge in the body
   * is money: owner (403), then open price edits (409), as for product prices.
   */
  async updateSize(admin: AdminUser, code: string, dto: AdminUpdateSizeDto): Promise<AdminSize> {
    if (dto.upcharge !== undefined) {
      if (!can(admin.role, 'catalog.price')) {
        throw new ForbiddenException('Only an owner can change a size upcharge.');
      }
      this.priceEdits.assertEnabled();
    }

    const size = await this.prisma.$transaction(async (tx) => {
      const current = await tx.size.findUnique({ where: { code } });
      if (!current) throw new NotFoundException(`No size with code "${code}".`);

      const before = sizeSnapshot(current);
      const diff = changedFields(before, {
        ...before,
        ...defined({ label: dto.label, upcharge: dto.upcharge, sortOrder: dto.sortOrder }),
      });
      if (Object.keys(diff.after).length === 0) return current;

      const updated = await tx.size.update({ where: { id: current.id }, data: diff.after });
      await this.audit.record(tx, {
        actorId: admin.id,
        action: 'size.update',
        entity: 'size',
        entityId: current.id,
        summary: `Changed ${Object.keys(diff.after).join(', ')}`,
        before: diff.before,
        after: diff.after,
      });
      return updated;
    });

    return toSize(size, await this.productRuns());
  }

  /**
   * Only a code nothing relies on (D11). The check and the delete share a
   * transaction so the answer is about the rows being deleted, not a moment
   * earlier; order lines keep their size as text, so history is unaffected.
   */
  async deleteSize(admin: AdminUser, code: string): Promise<{ ok: true }> {
    await this.prisma.$transaction(async (tx) => {
      const size = await tx.size.findUnique({ where: { code } });
      if (!size) throw new NotFoundException(`No size with code "${code}".`);

      const runs = await tx.product.findMany({ select: { sizes: true } });
      const refused = sizeDeleteError(code, countStocking(runs.map((r) => r.sizes), code));
      if (refused) throw new ConflictException(refused);

      await tx.size.delete({ where: { id: size.id } });
      await this.audit.record(tx, {
        actorId: admin.id,
        action: 'size.delete',
        entity: 'size',
        entityId: size.id,
        summary: `Deleted ${size.code}`,
        before: sizeSnapshot(size),
      });
    });
    return { ok: true };
  }

  // ------------------------------------------------------------ price tiers

  async tiers(): Promise<AdminTiers> {
    const rows = await this.prisma.priceTier.findMany({ orderBy: { minQty: 'asc' } });
    return { tiers: rows.map((t) => ({ minQty: t.minQty, discount: num(t.discount) })) };
  }

  /**
   * The whole ladder at once: a ladder is only valid as a whole, so there is no
   * per-tier endpoint that could leave it half-edited. Concurrent saves are last
   * writer wins, and both are in the audit log.
   */
  async replaceTiers(admin: AdminUser, dto: AdminReplaceTiersDto): Promise<AdminTiers> {
    this.priceEdits.assertEnabled();

    const refused = validateTiers(dto.tiers.map((t) => ({ min: t.minQty, off: t.discount })));
    if (refused) throw new BadRequestException(refused);

    const next = dto.tiers.map((t) => ({ minQty: t.minQty, discount: t.discount }));

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.priceTier.findMany({ orderBy: { minQty: 'asc' } });
      const before = rows.map((t) => ({ minQty: t.minQty, discount: num(t.discount) }));
      if (JSON.stringify(before) === JSON.stringify(next)) return { tiers: before };

      await tx.priceTier.deleteMany({});
      await tx.priceTier.createMany({ data: next });
      await this.audit.record(tx, {
        actorId: admin.id,
        action: 'tiers.replace',
        entity: 'price_tiers',
        entityId: LADDER_ID,
        summary: `Replaced the ladder (${before.length} tiers → ${next.length})`,
        before,
        after: next,
      });
      return { tiers: next };
    });
  }

  /** every product's size run - the catalog is a few dozen rows, so counting in memory is cheapest */
  private async productRuns(): Promise<string[][]> {
    const rows = await this.prisma.product.findMany({ select: { sizes: true } });
    return rows.map((r) => r.sizes);
  }
}

function defined<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) as Partial<T>;
}

type ColorRow = {
  slug: string;
  name: string;
  hex: string;
  dark: boolean;
  active: boolean;
  sortOrder: number;
  _count: { products: number; orderItems: number };
};

function colorSnapshot(c: ColorRow) {
  return { name: c.name, hex: c.hex, dark: c.dark, sortOrder: c.sortOrder, active: c.active };
}

function toColor(c: ColorRow): AdminColor {
  return {
    slug: c.slug,
    name: c.name,
    hex: c.hex,
    dark: c.dark,
    active: c.active,
    sortOrder: c.sortOrder,
    productCount: c._count.products,
    orderItemCount: c._count.orderItems,
  };
}

type SizeRow = { code: string; label: string; upcharge: Parameters<typeof num>[0]; sortOrder: number };

function sizeSnapshot(s: SizeRow) {
  return { label: s.label, upcharge: num(s.upcharge), sortOrder: s.sortOrder };
}

function toSize(s: SizeRow, runs: string[][]): AdminSize {
  return {
    code: s.code,
    label: s.label,
    upcharge: num(s.upcharge),
    sortOrder: s.sortOrder,
    productCount: countStocking(runs, s.code),
    builtIn: isBuiltInSize(s.code),
  };
}
