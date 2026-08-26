import { GarmentType, PrintMethod, type Prisma } from '@prisma/client';
import type { Colorway, GarmentType as GarmentTypeLiteral, Product } from '@inkhaus/shared';

import { num } from '../../common/decimal';

/**
 * The storefront speaks in the literals it always used ("tee", "Screen print").
 * The database speaks in enums. These two maps are the only place that bridges them,
 * and the seed script reads them in reverse.
 */
export const GARMENT_TYPE_TO_SLUG: Record<GarmentType, GarmentTypeLiteral> = {
  TEE: 'tee',
  HOODIE: 'hoodie',
  LONGSLEEVE: 'longsleeve',
  TANK: 'tank',
  CAP: 'cap',
  TOTE: 'tote',
  CREWNECK: 'crewneck',
};

export const SLUG_TO_GARMENT_TYPE = Object.fromEntries(
  Object.entries(GARMENT_TYPE_TO_SLUG).map(([k, v]) => [v, k as GarmentType]),
) as Record<GarmentTypeLiteral, GarmentType>;

export const METHOD_TO_LABEL: Record<PrintMethod, string> = {
  DTG: 'DTG',
  SCREEN_PRINT: 'Screen print',
  EMBROIDERY: 'Embroidery',
  PUFF: 'Puff',
  LEATHER_PATCH: 'Leather patch',
};

export const LABEL_TO_METHOD = Object.fromEntries(
  Object.entries(METHOD_TO_LABEL).map(([k, v]) => [v, k as PrintMethod]),
) as Record<string, PrintMethod>;

export type ProductWithColors = Prisma.ProductGetPayload<{
  include: { colors: { include: { color: true } } };
}>;

export const productInclude = {
  colors: { include: { color: true }, orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ProductInclude;

export type ProductDto = Product & { id: string };

/** DB row -> the exact `Product` shape the studio and grid already render. */
export function toProductDto(p: ProductWithColors): ProductDto {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    type: GARMENT_TYPE_TO_SLUG[p.type],
    blurb: p.blurb,
    fabric: p.fabric,
    price: num(p.price),
    bulkPrice: num(p.bulkPrice),
    method: p.methods.map((m) => METHOD_TO_LABEL[m]),
    colors: p.colors.map(({ color }) => toColorway(color)),
    ...(p.tag ? { tag: p.tag } : {}),
    printArea: { x: p.printAreaX, y: p.printAreaY, w: p.printAreaW, h: p.printAreaH },
    printInches: { w: num(p.printInchesW), h: num(p.printInchesH) },
  };
}

export function toColorway(c: { name: string; hex: string; dark: boolean }): Colorway {
  return c.dark ? { name: c.name, hex: c.hex, dark: true } : { name: c.name, hex: c.hex };
}
