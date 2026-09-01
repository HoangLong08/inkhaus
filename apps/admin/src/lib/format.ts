const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export const usd = (value: number) => money.format(value);
export const at = (value: string | Date) => dateTime.format(new Date(value));
export const on = (value: string | Date) => dateOnly.format(new Date(value));

/** PENDING_PAYMENT -> Pending payment */
export function humanize(value: string) {
  const lower = value.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
