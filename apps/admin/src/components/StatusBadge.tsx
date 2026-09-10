import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/format";

/**
 * Colour carries meaning here, so it is never the only signal - the label is
 * always spelled out beside it.
 *
 * The twelve entries below were already a variant table; cva only gives it a
 * type, so a status can no longer be pointed at a class string that does not
 * exist. The tones stay tied to the INKHAUS ramp rather than shadcn's Badge
 * variants: `destructive` would make a refund shout as loudly as an error.
 */
const tones = cva("rounded-full", {
  variants: {
    tone: {
      neutral: "border-line bg-paper-2 text-ink-3 dark:bg-muted dark:text-muted-foreground",
      muted: "border-line bg-paper-3 text-ink-3 dark:bg-muted dark:text-muted-foreground",
      warn: "border-amber/30 bg-amber/10 text-amber",
      info: "border-sky/30 bg-sky/10 text-sky",
      good: "border-moss/30 bg-moss/10 text-moss",
      goodStrong: "border-moss/40 bg-moss/15 text-moss",
      bad: "border-flame/30 bg-flame/10 text-flame",
    },
  },
  defaultVariants: { tone: "neutral" },
});

type Tone = NonNullable<VariantProps<typeof tones>["tone"]>;

const TONE: Record<string, Tone> = {
  // orders
  DRAFT: "neutral",
  PENDING_PAYMENT: "warn",
  PAID: "info",
  IN_PRODUCTION: "info",
  SHIPPED: "good",
  DELIVERED: "goodStrong",
  CANCELLED: "muted",
  REFUNDED: "bad",
  // quotes
  NEW: "warn",
  CONTACTED: "info",
  WON: "goodStrong",
  LOST: "muted",
};

/**
 * `data-status` carries the raw enum value so a test never has to know about
 * humanize(); the text stays the human label.
 */
export default function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      data-testid="status-badge"
      data-status={status}
      className={cn(tones({ tone: TONE[status] }), className)}
    >
      {humanize(status)}
    </Badge>
  );
}
