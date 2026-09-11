/**
 * Day and money labels for the overview, shared by its server sections and the
 * chart.
 *
 * Every day on this page is a UTC calendar day (decision D8), so it is printed
 * in UTC as well. `on()` from lib/format uses the server's own zone, which
 * would label the 5 Sep bucket "Sep 4" on any machine west of Greenwich - and
 * the chart, formatting in the browser, would disagree with the table beside it.
 */

const shortFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const longFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** a `YYYY-MM-DD` day, or a timestamp at midnight UTC, as that UTC midnight */
const utcDay = (day: string) => new Date(`${day.slice(0, 10)}T00:00:00Z`);

/** `2026-09-05` -> "Sep 5" */
export const shortDay = (day: string) => shortFormat.format(utcDay(day));

/** `2026-09-05` -> "Sep 5, 2026" */
export const longDay = (day: string) => longFormat.format(utcDay(day));

/** "Sep 5 – 11, 2026" - the month and year are written once when they repeat */
export const dayRange = (from: string, to: string) =>
  longFormat.formatRange(utcDay(from), utcDay(to));

/** axis ticks: 12500 -> "$12.5K" */
export const compactUsd = (value: number) => compactMoney.format(value);
