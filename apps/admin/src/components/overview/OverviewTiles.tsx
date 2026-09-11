import type { OrderStatusCode } from "@inkhaus/shared/orders";
import Link from "next/link";

import { ORDER_QUEUES } from "@/components/nav/nav-config";
import StatusBadge from "@/components/StatusBadge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { count } from "@/lib/format";
import type { OverviewQuery } from "@/lib/schemas/params";

import { getOverview } from "./data";

type TileProps = {
  /** `data-status` - the order status, or NEW_QUOTES / PENDING_REVIEWS */
  status: string;
  href: string;
  total: number;
  label: React.ReactNode;
};

/**
 * What is waiting on somebody right now - all time, whatever the range below
 * says. Every tile links to the list it counts with the same filter, so the
 * number on the tile is the total at the top of the page it opens.
 *
 * Drafts reads `orders.byStatus.DRAFT` rather than the API's `drafts`: the same
 * number, from a baseline key every API version sends.
 */
export default async function OverviewTiles({ params }: { params: OverviewQuery }) {
  const stats = await getOverview(params);

  const orderTile = (status: OrderStatusCode): TileProps => ({
    status,
    href: `/orders?status=${status}`,
    total: stats.orders.byStatus[status] ?? 0,
    label: <StatusBadge status={status} />,
  });

  const tiles: TileProps[] = [
    ...ORDER_QUEUES.map(orderTile),
    orderTile("DRAFT"),
    {
      status: "NEW_QUOTES",
      href: "/quotes?status=NEW",
      total: stats.quotes.byStatus.NEW ?? 0,
      label: <TileLabel>New bulk quotes</TileLabel>,
    },
    {
      status: "PENDING_REVIEWS",
      href: "/reviews?status=PENDING",
      total: stats.reviews.pending,
      label: <TileLabel>Pending reviews</TileLabel>,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {tiles.map((tile) => (
        <Tile key={tile.status} {...tile} />
      ))}
    </div>
  );
}

function TileLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground text-xs font-semibold">{children}</span>;
}

/** Card takes no asChild, so the link wraps it rather than the other way round */
function Tile({ href, status, total, label }: TileProps) {
  return (
    <Link
      href={href}
      className="block"
      data-testid="stat-tile"
      data-status={status}
      data-count={total}
    >
      <Card className="hover:border-foreground/30 h-full gap-2 transition hover:shadow-sm">
        <CardHeader className="pb-0">{label}</CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{count(total)}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
