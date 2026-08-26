import { Suspense } from "react";
import type { Metadata } from "next";
import OrderStatus from "@/components/orders/OrderStatus";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ number: string }>;
}): Promise<Metadata> {
  const { number } = await params;
  return {
    title: `Order ${decodeURIComponent(number)} — INKHAUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;

  // OrderStatus reads ?placed=1 with useSearchParams, which has to sit under a
  // Suspense boundary or the prerender pass bails out of the whole route.
  return (
    <Suspense fallback={<OrderFallback />}>
      <OrderStatus number={decodeURIComponent(number)} />
    </Suspense>
  );
}

function OrderFallback() {
  return (
    <div className="pt-[calc(var(--nav-h)+50px)]">
      <div className="edge py-24 text-[13px] uppercase tracking-[0.16em] text-ink/40">
        Loading your order…
      </div>
    </div>
  );
}
