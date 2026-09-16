import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import {
  Ban,
  CircleCheck,
  CircleSlash,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  Inbox,
  MessageSquare,
  PackageCheck,
  Printer,
  Trophy,
  Truck,
  Undo2,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useStatusLabel } from "@/i18n/labels";

/**
 * Colour carries meaning here, so it is never the only signal - the label is
 * always spelled out beside it.
 *
 * The entries below were already a variant table; cva only gives it a type, so
 * a status can no longer be pointed at a class string that does not exist. The
 * tones stay tied to the INKHAUS ramp rather than shadcn's Badge variants:
 * `destructive` would make a refund shout as loudly as an error.
 */
const tones = cva("rounded-md px-2.5 py-0.5 font-semibold", {
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
  // reviews - a pending one is waiting on somebody, like a new quote
  PENDING: "warn",
  PUBLISHED: "good",
  REJECTED: "muted",
  // anything that can be switched off: products, colours, staff
  ACTIVE: "good",
  INACTIVE: "muted",
};

/**
 * A glyph per status, on the same keys as `TONE`. It is decorative and says
 * nothing the label does not - colour is already never the only signal here, and
 * an icon is not one either. It is there so a status is recognisable at a glance
 * down a column of forty rows.
 *
 * A status with no entry simply renders without one, which is what keeps a new
 * enum value from being a crash.
 */
const ICON: Record<string, LucideIcon> = {
  // orders
  DRAFT: FileText,
  PENDING_PAYMENT: Clock,
  PAID: CreditCard,
  IN_PRODUCTION: Printer,
  SHIPPED: Truck,
  DELIVERED: PackageCheck,
  CANCELLED: Ban,
  REFUNDED: Undo2,
  // quotes
  NEW: Inbox,
  CONTACTED: MessageSquare,
  WON: Trophy,
  LOST: CircleSlash,
  // reviews
  PENDING: Clock,
  PUBLISHED: Eye,
  REJECTED: EyeOff,
  // anything that can be switched off
  ACTIVE: CircleCheck,
  INACTIVE: CircleSlash,
};

/** The glyph a status is drawn with, or undefined. One map, two callers. */
export function statusIcon(status: string): LucideIcon | undefined {
  return ICON[status];
}

/**
 * The ramp colour a status reads in, for the places that show its glyph without
 * the pill around it - the orders queue strip. Derived from the same `TONE` table
 * so a status cannot be one colour in a badge and another in a strip.
 */
const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  muted: "text-muted-foreground",
  warn: "text-amber",
  info: "text-sky",
  good: "text-moss",
  goodStrong: "text-moss",
  bad: "text-flame",
};

export function statusColor(status: string): string {
  return TONE_TEXT[TONE[status] ?? "neutral"];
}

/**
 * `data-status` carries the raw enum value so a test never has to know about the
 * label; the text stays the human label, now in the viewer's language.
 *
 * `useStatusLabel` is a hook, which is fine here: this is a shared component -
 * no "use client", not async - so it runs as a Server Component inside the
 * server-rendered tables and as a Client Component inside the leaves, and
 * next-intl's `useTranslations` works in both. It is not reachable from
 * (print), which has no provider.
 */
export default function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const label = useStatusLabel();
  const Icon = ICON[status];

  return (
    <Badge
      variant="outline"
      data-testid="status-badge"
      data-status={status}
      className={cn(tones({ tone: TONE[status] }), className)}
    >
      {Icon ? <Icon aria-hidden /> : null}
      {label(status)}
    </Badge>
  );
}
