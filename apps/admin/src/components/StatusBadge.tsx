import { humanize } from "@/lib/format";

/**
 * Colour carries meaning here, so it is never the only signal - the label is
 * always spelled out beside it.
 */
const TONE: Record<string, string> = {
  // orders
  DRAFT: "border-line bg-paper-2 text-ink-3",
  PENDING_PAYMENT: "border-amber/30 bg-amber/10 text-amber",
  PAID: "border-sky/30 bg-sky/10 text-sky",
  IN_PRODUCTION: "border-sky/30 bg-sky/10 text-sky",
  SHIPPED: "border-moss/30 bg-moss/10 text-moss",
  DELIVERED: "border-moss/40 bg-moss/15 text-moss",
  CANCELLED: "border-line bg-paper-3 text-ink-3",
  REFUNDED: "border-flame/30 bg-flame/10 text-flame",
  // quotes
  NEW: "border-amber/30 bg-amber/10 text-amber",
  CONTACTED: "border-sky/30 bg-sky/10 text-sky",
  WON: "border-moss/40 bg-moss/15 text-moss",
  LOST: "border-line bg-paper-3 text-ink-3",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        TONE[status] ?? "border-line bg-paper-2 text-ink-3"
      }`}
    >
      {humanize(status)}
    </span>
  );
}
