import { isoDay } from '../../common/date-range';
import { round2 } from '../../common/decimal';

/** one day of the overview's series - a UTC calendar day, never a local one (D8) */
export type DailyPoint = { date: string; orders: number; revenue: number };

/** a row of the bucket query: the start of a day (or any instant within it) and what it earned */
export type DailyBucket = { day: Date; orders: number; revenue: number };

/**
 * One point for every day of the range, in order, zero where nothing happened.
 *
 * The query only returns days that had orders, and a chart fed those alone
 * draws a quiet week as a straight line between two busy days. Buckets are keyed
 * by their UTC day, so an order at 23:59Z on the last day counts on that day
 * whatever zone the server runs in; a bucket outside the range is dropped rather
 * than stretching the axis.
 */
export function fillDailySeries(
  days: readonly string[],
  buckets: readonly DailyBucket[],
): DailyPoint[] {
  const byDay = new Map<string, { orders: number; revenue: number }>();
  for (const bucket of buckets) {
    const key = isoDay(bucket.day);
    const seen = byDay.get(key) ?? { orders: 0, revenue: 0 };
    byDay.set(key, { orders: seen.orders + bucket.orders, revenue: seen.revenue + bucket.revenue });
  }

  return days.map((date) => {
    const hit = byDay.get(date);
    return { date, orders: hit?.orders ?? 0, revenue: round2(hit?.revenue ?? 0) };
  });
}

/**
 * Won out of decided, to four places. Open quotes count neither way - a quote
 * nobody has answered yet is not a loss.
 *
 * Null when nothing is decided: 0/0 means "not known yet", and printing it as
 * 0% would read as "we lose every quote".
 */
export function conversionRate(won: number, lost: number): number | null {
  const decided = won + lost;
  if (decided === 0) return null;
  return Math.round((won / decided) * 10_000) / 10_000;
}
