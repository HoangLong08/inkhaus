/**
 * Every number, date and label the back office prints. en-US and USD throughout
 * (decision: the admin UI stays English). FROZEN after Phase 0.
 *
 * **Dates and times are shown in UTC**, never in the machine's own zone. The
 * API buckets days in UTC (decision D8), and a formatter that used the local
 * zone printed a different string on the server than in the browser - a
 * hydration error in every client leaf that shows a time - and put a UTC day on
 * the day before anywhere west of Greenwich. `at()` spells the zone out, so
 * nobody reads "11:30 PM" as their own evening.
 */

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
// dateStyle/timeStyle cannot be combined with timeZoneName, hence the fields
const dateTime = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});
const dateOnly = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const grouped = new Intl.NumberFormat("en-US");
const relativeTime = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

export const usd = (value: number) => money.format(value);
/** an instant: "Sep 5, 2026, 11:30 PM UTC" */
export const at = (value: string | Date) => dateTime.format(new Date(value));
/** the UTC calendar day: "Sep 5, 2026". A bare `YYYY-MM-DD` is read as that UTC day. */
export const on = (value: string | Date) => dateOnly.format(new Date(value));

/** a ratio, not a percentage: 0.123 -> "12.3%" */
export const pct = (ratio: number) => percent.format(ratio);

/** 12345 -> "12,345" */
export const count = (value: number) => grouped.format(value);

/** the UTC calendar day, `YYYY-MM-DD` - the form every `from`/`to` in a URL takes */
export const isoDay = (value: string | Date) => new Date(value).toISOString().slice(0, 10);

/** largest unit first; a week is left out on purpose, "9 days ago" beats "last week" */
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86_400],
  ["month", 30 * 86_400],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
];

/**
 * "3 days ago", "in 2 hours", "yesterday". The default `now` is fine in a Server
 * Component, which renders once. A client component must pass `now` - a value
 * both renders share, such as the query's `dataUpdatedAt` - or the server and
 * the browser print different strings and hydration fails.
 */
export function relative(value: string | Date, now: number = Date.now()) {
  const seconds = (new Date(value).getTime() - now) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size || unit === "second") {
      return relativeTime.format(Math.round(seconds / size), unit);
    }
  }
  return relativeTime.format(0, "second");
}

/** PENDING_PAYMENT -> Pending payment */
export function humanize(value: string) {
  const lower = value.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
