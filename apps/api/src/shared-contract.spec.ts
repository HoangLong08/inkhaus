import {
  AdminRole,
  GarmentType,
  OrderEventKind,
  OrderStatus,
  PrintMethod,
  QuoteEventKind,
  QuoteStatus,
  ReviewStatus,
} from '@prisma/client';
import {
  ADMIN_ROLES,
  GARMENT_TYPES,
  ORDER_EVENT_KINDS,
  ORDER_STATUSES,
  PRINT_METHOD_LABEL,
  PRINT_METHODS,
  QUOTE_EVENT_KINDS,
  QUOTE_STATUSES,
  REVIEW_STATUSES,
} from '@inkhaus/shared';

import { GARMENT_TYPE_TO_SLUG, METHOD_TO_LABEL } from './modules/catalog/catalog.mapper';

/**
 * The database enums and the lists in @inkhaus/shared describe the same things
 * from two sides - Prisma for what a column may hold, shared for what the admin
 * offers and the storefront renders - and nothing else ties them together. A
 * status in the schema but not in shared is a row the admin cannot filter to;
 * the other way round is a dropdown option the API answers with a 400.
 *
 * Compared as sets: each side orders its list for its own reasons.
 */
const sorted = (values: Iterable<string>) => [...values].sort();

describe('Prisma enums match @inkhaus/shared', () => {
  it.each<[string, Record<string, string>, readonly string[]]>([
    ['OrderStatus', OrderStatus, ORDER_STATUSES],
    ['QuoteStatus', QuoteStatus, QUOTE_STATUSES],
    ['AdminRole', AdminRole, ADMIN_ROLES],
    ['ReviewStatus', ReviewStatus, REVIEW_STATUSES],
    ['OrderEventKind', OrderEventKind, ORDER_EVENT_KINDS],
    ['QuoteEventKind', QuoteEventKind, QUOTE_EVENT_KINDS],
    ['PrintMethod', PrintMethod, PRINT_METHODS],
    // the storefront spells garment types in lower case
    ['GarmentType', GarmentType, GARMENT_TYPES.map((t) => t.toUpperCase())],
  ])('%s', (_name, prismaEnum, shared) => {
    expect(sorted(Object.values(prismaEnum))).toEqual(sorted(shared));
  });

  it('maps every garment type to a storefront slug', () => {
    expect(sorted(Object.values(GARMENT_TYPE_TO_SLUG))).toEqual(sorted(GARMENT_TYPES));
  });

  it('labels print methods with the shared table', () => {
    expect(METHOD_TO_LABEL).toEqual(PRINT_METHOD_LABEL);
    expect(sorted(Object.keys(PRINT_METHOD_LABEL))).toEqual(sorted(Object.values(PrintMethod)));
  });
});
