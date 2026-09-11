/**
 * Day and money labels for the overview, shared by its server sections and the
 * chart.
 *
 * Every day on this page is a UTC calendar day (decision D8), and the whole back
 * office now prints dates in UTC too, so a single day is simply `on()` from
 * lib/format. What is left here are the two shapes lib/format has no use for
 * elsewhere - the chart's short axis tick and a range caption - in the same
 * zone, so the chart, the table and the caption all agree with the API's
 * buckets on any machine.
 */

const shortFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const rangeFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
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

/** "Sep 5 – 11, 2026" - the month and year are written once when they repeat */
export const dayRange = (from: string, to: string) =>
  rangeFormat.formatRange(utcDay(from), utcDay(to));

/** axis ticks: 12500 -> "$12.5K" */
export const compactUsd = (value: number) => compactMoney.format(value);
