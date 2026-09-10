import { z } from "zod";

/**
 * The building blocks every list page's URL is parsed with.
 *
 * Every one ends in `.catch()`, outermost, which is what lets a page call
 * `.parse()` with no try/catch: a hand-typed `?page=lol` or `?limit=7` degrades
 * to the default instead of reaching the API as a 400 and the operator as a 500.
 * A repeated key (`?q=a&q=b`) arrives from Next as a string[], fails the inner
 * check, and lands on the fallback too.
 *
 * FROZEN after Phase 0. Feature schemas compose these; they do not redefine
 * them, or `?page=0` means one thing on /orders and another on /customers.
 */

export const PAGE_SIZES = [20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 20;

/** 1-based; anything else is page 1 */
export const pageParam = z.coerce.number().int().min(1).catch(1);

/** one of PAGE_SIZES; anything else is the default, never "whatever was asked for" */
export const limitParam = z.coerce.number().pipe(z.literal(PAGE_SIZES)).catch(DEFAULT_PAGE_SIZE);

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A calendar day, `YYYY-MM-DD`, read as UTC (decision D8). The round trip
 * rejects a well-formed impossible date: `2026-02-31` would otherwise roll over
 * into March and filter a range nobody asked for.
 */
export const isoDayParam = z
  .string()
  .regex(ISO_DAY)
  .refine((day) => {
    const date = new Date(`${day}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day);
  })
  .optional()
  .catch(undefined);

/** free text, trimmed; blank or over 100 characters means no search at all */
export const searchParam = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((value) => value || undefined)
  .catch(undefined);
