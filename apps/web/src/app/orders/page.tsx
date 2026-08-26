import type { Metadata } from "next";
import OrderLookup from "@/components/orders/OrderLookup";

export const metadata: Metadata = {
  title: "Track an order — INKHAUS",
  description: "Look up an INKHAUS order by its number and see exactly where it is.",
};

export default function Page() {
  return <OrderLookup />;
}
