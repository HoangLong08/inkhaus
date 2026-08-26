import type { Metadata } from "next";
import CartPage from "@/components/cart/CartPage";

export const metadata: Metadata = {
  title: "Cart — INKHAUS",
  description: "Your INKHAUS order: sizes, quantities and the volume price you have earned.",
  // a personal, client-rendered page; nothing here belongs in an index
  robots: { index: false, follow: true },
};

export default function Page() {
  return <CartPage />;
}
