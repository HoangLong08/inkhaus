import Link from "next/link";

import { ORDER_QUEUES } from "@/components/nav/nav-config";
import StatusBadge from "@/components/StatusBadge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { adminApi } from "@/lib/api";
import { count } from "@/lib/format";

/**
 * One stats call, counted by the database. The tiles used to make five list
 * requests - four order queues and the new quotes - and read nothing from any
 * of them but `meta.total`.
 */
export default async function OverviewTiles() {
  const stats = await adminApi.stats.overview();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {ORDER_QUEUES.map((status) => (
        <Tile
          key={status}
          href={`/orders?status=${status}`}
          status={status}
          total={stats.orders.byStatus[status] ?? 0}
          label={<StatusBadge status={status} />}
        />
      ))}
      <Tile
        href="/quotes?status=NEW"
        status="NEW_QUOTES"
        total={stats.quotes.byStatus.NEW ?? 0}
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
          <p className="text-2xl font-bold tabular-nums">{count(total)}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
