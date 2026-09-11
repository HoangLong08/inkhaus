import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CustomerDetail } from "@/lib/api";
import { count, on, usd } from "@/lib/format";

type Tile = {
  stat: "lifetime-value" | "orders" | "average-order" | "refunded" | "quotes" | "designs";
  label: string;
  /** the raw number, on `data-value`, so a test compares a value and not its formatting */
  value: number;
  shown: string;
  hint: string;
};

/**
 * What this customer is worth to the shop. Server rendered: none of it can
 * change from the profile, so none of it needs the client cache.
 */
export default function CustomerStats({ customer }: { customer: CustomerDetail }) {
  const { stats } = customer;

  const tiles: Tile[] = [
    {
      stat: "lifetime-value",
      label: "Lifetime value",
      value: customer.lifetimeValue,
      shown: usd(customer.lifetimeValue),
      hint: "paid and not refunded",
    },
    {
      stat: "orders",
      label: "Orders",
      value: customer.orderCount,
      shown: count(customer.orderCount),
      hint: stats.firstOrderAt ? `first on ${on(stats.firstOrderAt)}` : "none placed yet",
    },
    {
      stat: "average-order",
      label: "Average order",
      value: stats.averageOrder,
      shown: usd(stats.averageOrder),
      hint: "across paid orders",
    },
    {
      stat: "refunded",
      label: "Refunded",
      value: stats.refunded,
      shown: usd(stats.refunded),
      hint: "given back",
    },
    {
      stat: "quotes",
      label: "Bulk quotes",
      value: stats.quoteCount,
      shown: count(stats.quoteCount),
      hint: `${count(stats.openQuoteCount)} still open`,
    },
    {
      stat: "designs",
      label: "Saved designs",
      value: stats.designCount,
      shown: count(stats.designCount),
      hint: "from the studio",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map((tile) => (
        <Card
          key={tile.stat}
          className="gap-1 py-4"
          data-testid="customer-stat"
          data-stat={tile.stat}
          data-value={tile.value}
        >
          <CardHeader className="px-4">
            <CardDescription>{tile.label}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{tile.shown}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground px-4 text-xs">{tile.hint}</CardContent>
        </Card>
      ))}
    </div>
  );
}
