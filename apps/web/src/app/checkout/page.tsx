import type { Metadata } from "next";
import CheckoutForm from "@/components/checkout/CheckoutForm";

export const metadata: Metadata = {
  title: "Checkout — INKHAUS",
  description: "Place your INKHAUS order. Free digital proof before anything is printed.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <CheckoutForm />;
}
