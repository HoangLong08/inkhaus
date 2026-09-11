import { cn } from "cn";

import type { AdminOrderDetail } from "@/lib/schemas/api";

/** the ship-to block, shared by the order page and its packing slip */
export default function ShippingAddress({
  address,
  className,
}: {
  address: AdminOrderDetail["shippingAddress"];
  className?: string;
}) {
  if (!address.line1) {
    return <p className={cn("text-muted-foreground text-sm", className)}>No address on this order.</p>;
  }

  const lines = [
    address.name,
    address.line1,
    address.line2,
    [address.city, address.state, address.postal].filter(Boolean).join(", "),
    address.country,
  ].filter(Boolean);

  return (
    <address className={cn("text-sm not-italic leading-relaxed", className)}>
      {lines.map((line, i) => (
        <span key={i} className="block">
          {line}
        </span>
      ))}
    </address>
  );
}
