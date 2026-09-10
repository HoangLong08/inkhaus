import Link from "next/link";

import StatusBadge from "@/components/StatusBadge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { adminApi, type OrderStatus } from "@/lib/api";

/** the statuses someone actually has to do something about */
const QUEUES: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "IN_PRODUCTION", "SHIPPED"];

export default async function OverviewTiles() {
  // there is no stats endpoint, so each tile is a limit=1 list read for its
  // meta.total. Cheap, and it cannot drift from what the list pages show.
  const [newQuotes, ...queues] = await Promise.all([
    adminApi.quotes({ status: "NEW" }),
    ...QUEUES.map((status) => adminApi.orders({ status })),
  ]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {QUEUES.map((status, i) => (
        <Tile
          key={status}
          href={`/orders?status=${status}`}
          status={status}
          total={queues[i].meta.total}
          label={<StatusBadge status={status} />}
        />
      ))}
      <Tile
        href="/quotes?status=NEW"
        status="NEW_QUOTES"
        total={newQuotes.meta.total}
        label={
          <span className="text-muted-foreground text-xs font-semibold">New bulk quotes</span>
        }
      />
    </div>
  );
}

/** Card takes no asChild, so the link wraps it rather than the other way round */
function Tile({
  href,
  status,
  total,
  label,
}: {
  href: string;
  status: string;
  total: number;
  label: React.ReactNode;
}) {
  return (
    <Link href={href} className="block" data-testid="stat-tile" data-status={status}>
      <Card className="hover:border-ink-3 gap-2 transition hover:shadow-sm">
        <CardHeader className="pb-0">{label}</CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">{total}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
