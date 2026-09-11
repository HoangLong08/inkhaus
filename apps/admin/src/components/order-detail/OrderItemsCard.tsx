import { Badge } from "@/components/ui/badge";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { count, usd } from "@/lib/format";
import type { AdminOrderDetail, AdminOrderDetailItem } from "@/lib/schemas/api";

import DesignPreview from "./DesignPreview";
import { methodLabel } from "./format";

/**
 * What was ordered and what it cost, down to each size - server rendered,
 * because nothing on this screen can change it. The per-size rows are the
 * answer to "why is this line not quantity × price": a 2XL carries an upcharge
 * the tier price does not show.
 */
export default function OrderItemsCard({ order }: { order: AdminOrderDetail }) {
  const units = order.items.reduce((n, item) => n + item.quantity, 0);

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="bg-muted/50 border-b px-4 py-2.5">
        <CardTitle className="text-muted-foreground flex justify-between text-xs font-semibold uppercase tracking-wide">
          <span>Items</span>
          <span className="tabular-nums">{count(units)} units</span>
        </CardTitle>
      </CardHeader>

      {order.items.length === 0 ? (
        <p className="text-muted-foreground px-4 py-3 text-sm">This order has no items.</p>
      ) : (
        <ul className="divide-y">
          {order.items.map((item, i) => (
            <li key={i}>
              <OrderLine item={item} />
            </li>
          ))}
        </ul>
      )}

      <CardFooter className="bg-muted/50 flex-col items-stretch gap-1 border-t px-4 py-3 text-sm">
        <dl className="space-y-1">
          <Row label="Subtotal" value={usd(order.subtotal)} />
          {order.discount > 0 ? <Row label="Discount" value={`−${usd(order.discount)}`} /> : null}
          <Row label="Shipping" value={order.shipping === 0 ? "Free" : usd(order.shipping)} />
          {order.tax > 0 ? <Row label="Tax" value={usd(order.tax)} /> : null}
          <div className="flex justify-between border-t pt-1.5 font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{usd(order.total)}</dd>
          </div>
        </dl>
      </CardFooter>
    </Card>
  );
}

function OrderLine({ item }: { item: AdminOrderDetailItem }) {
  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">{item.productName}</span>
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
          {/* the one legitimate inline colour in this app: it is product data,
              not a design token */}
          <span
            aria-hidden
            className="inline-block size-3 rounded-full border"
            style={{ background: item.color.hex }}
          />
          {item.color.name}
        </span>
        <Badge variant="outline" data-method={item.method}>
          {methodLabel(item.method)}
        </Badge>
        <span className="ml-auto text-sm font-semibold tabular-nums">{usd(item.lineTotal)}</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Size</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Each</TableHead>
            <TableHead className="text-right">Line</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {item.sizes.map((size) => (
            <TableRow key={size.size} data-size={size.size}>
              <TableCell className="font-medium">{size.size}</TableCell>
              <TableCell className="text-right tabular-nums">×{size.qty}</TableCell>
              <TableCell className="text-right tabular-nums">
                {size.upcharge > 0 ? (
                  <>
                    {usd(item.unitPrice)}{" "}
                    <span className="text-muted-foreground">+ {usd(size.upcharge)}</span>
                  </>
                ) : (
                  usd(size.unitPrice)
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{usd(size.lineTotal)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="text-muted-foreground text-xs">
        {count(item.quantity)} units at a {usd(item.unitPrice)} tier price
      </p>

      <DesignPreview design={item.design} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-muted-foreground flex justify-between">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
