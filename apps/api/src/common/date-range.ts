import { BadRequestException } from '@nestjs/common';
import { STATS_RANGE_DAYS, STATS_RANGES, type StatsRange } from '@inkhaus/shared';

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DateRangeInput = {
  /** YYYY-MM-DD, inclusive */
  from?: string;
  /** YYYY-MM-DD, inclusive */
  to?: string;
  /** one of STATS_RANGES, ending today */
  range?: string;
};

export type ResolvedRange = {
  /** midnight UTC of the first day */
  from: Date;
  /** midnight UTC of the day AFTER the last one - filter with `lt`, never `lte` */
  toExclusive: Date;
  /** every day in the range, YYYY-MM-DD, first to last - the x axis of a daily series */
  days: string[];
};

/**
 * Turns what a URL says about time into the half-open interval a query needs.
 *
 * Every day is a UTC day (decision D8). The database stores UTC, and using the
 * viewer's zone would make "orders on the 15th" a different set of rows for two
 * people looking at the same link.
 *
 * - `from` and `to` are both inclusive, because that is how a person reads
 *   "1 Aug - 3 Aug"; `toExclusive` is what a `lt` filter wants.
 * - an explicit `from`/`to` wins over `range`. `from` alone runs to today and
 *   `to` alone reaches back `defaultDays`.
 * - `range` ("7d") and the default both end today, today included.
 *
 * An inverted range, one longer than `maxDays`, or a day that does not exist is
 * a 400. `DateRangeDto` catches the shape first, but this is the function every
 * caller shares, so it does not assume a DTO ran.
 */
export function resolveRange(
  input: DateRangeInput,
  now: Date,
  { defaultDays = 30, maxDays = 366 }: { defaultDays?: number; maxDays?: number } = {},
): ResolvedRange {
  const today = startOfUtcDay(now);
  let from: Date;
  let to: Date;

  if (input.from || input.to) {
    to = input.to ? parseDay(input.to, 'to') : today;
    from = input.from ? parseDay(input.from, 'from') : addDays(to, -(defaultDays - 1));
  } else if (input.range) {
    if (!isStatsRange(input.range)) {
      throw new BadRequestException(`range must be one of ${STATS_RANGES.join(', ')}`);
    }
    to = today;
    from = addDays(today, -(STATS_RANGE_DAYS[input.range] - 1));
  } else {
    to = today;
    from = addDays(today, -(defaultDays - 1));
  }

  if (from.getTime() > to.getTime()) {
    throw new BadRequestException('"from" must be on or before "to"');
  }
  const count = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
  if (count > maxDays) {
    throw new BadRequestException(`A date range can cover at most ${maxDays} days`);
  }

  return {
    from,
    toExclusive: addDays(to, 1),
    days: Array.from({ length: count }, (_, i) => isoDay(addDays(from, i))),
  };
}

/** YYYY-MM-DD of a moment, in UTC */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isStatsRange(value: string): value is StatsRange {
  return (STATS_RANGES as readonly string[]).includes(value);
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** UTC has no daylight saving, so a day is always exactly DAY_MS */
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/**
 * One `YYYY-MM-DD` as midnight UTC that day, or a 400 naming the parameter it
 * came in as. The one test of "a real UTC day" every date filter shares.
 */
export function parseDay(value: string, name: 'from' | 'to'): Date {
  const m = ISO_DAY.exec(value);
  const d = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
  // Date.UTC rolls 2026-02-30 over into March instead of failing; only the
  // round trip tells a real day from a typo
  if (!d || isoDay(d) !== value) {
    throw new BadRequestException(`"${name}" must be a date as YYYY-MM-DD`);
  }
  return d;
}
