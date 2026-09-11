import type { QuoteStatusCode } from "@inkhaus/shared/orders";

import { isoDay } from "@/lib/format";

/**
 * A follow-up is a day, not an instant: the API stores midnight UTC of the day
 * picked (decision D8). Everything here keeps it a day. `on()` from
 * lib/format would render midnight UTC in the viewer's zone - the day before,
 * anywhere west of Greenwich.
 */

const utcDayFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** `2026-09-14T00:00:00.000Z` or `2026-09-14` -> "Sep 14, 2026" */
export function formatFollowUp(value: string) {
  return utcDayFormat.format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value));
}

/** today by the UTC calendar, `YYYY-MM-DD` */
export function todayUtc() {
  return isoDay(new Date());
}

const OPEN: readonly QuoteStatusCode[] = ["NEW", "CONTACTED"];

export type FollowUpState = "overdue" | "today" | "upcoming";

/**
 * Where a follow-up stands. Null when there is none, or when the quote is won
 * or lost - a closed lead keeps its date but nobody needs chasing about it,
 * which is the same rule the API's `followUp=overdue` filter applies.
 */
export function followUpState(
  followUpAt: string | null,
  status: QuoteStatusCode,
  today: string,
): FollowUpState | null {
  if (!followUpAt || !OPEN.includes(status)) return null;
  const day = isoDay(followUpAt);
  if (day < today) return "overdue";
  return day === today ? "today" : "upcoming";
}

/**
 * The calendar draws local days. The conversion is by components - the UTC day
 * `2026-09-14` is the local midnight the calendar draws September 14th at -
 * never through `toISOString`, which would shift it a day.
 */
export function dayToDate(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dateToDay(date: Date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}
