import { Prisma } from '@prisma/client';

/** Prisma Decimals serialise to strings in JSON - the storefront wants numbers. */
export const num = (v: Prisma.Decimal | number | null | undefined): number =>
  v === null || v === undefined ? 0 : typeof v === 'number' ? v : v.toNumber();

export const round2 = (n: number) => Math.round(n * 100) / 100;
