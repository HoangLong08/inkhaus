/**
 * Every number, date and label the back office prints. en-US and USD throughout
 * (decision: the admin UI stays English). FROZEN after Phase 0.
 */

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const grouped = new Intl.NumberFormat("en-US");
const relativeTime = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

export const usd = (value: number) => money.format(value);
export const at = (value: string | Date) => dateTime.format(new Date(value));
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
 * "3 days ago", "in 2 hours", "yesterday". `now` is a parameter so a caller that
 * renders on the server and the client can pin both to the same instant.
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
