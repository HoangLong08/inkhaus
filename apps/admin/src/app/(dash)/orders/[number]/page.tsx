import { canSetStatus, ORDER_TRANSITIONS, type OrderStatusCode } from "@inkhaus/shared";
import Link from "next/link";
import { notFound } from "next/navigation";

import { setOrderStatus } from "@/app/actions";
import StatusBadge from "@/components/StatusBadge";
import { adminApi, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";
import { at, humanize, usd } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return { title: `${number} — INKHAUS Back Office` };
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ number }, { error }, user] = await Promise.all([
    params,
    searchParams,
    // cached by the DAL, so this costs nothing beyond the layout's own call
    requireAdmin(),
  ]);

  const order = await adminApi.order(number).catch((err) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });

  // Two filters, and both matter: the transition table says what is reachable
  // from here, the role says what this person may reach. Staff simply never see
  // Cancel or Refund - offering a button that always 403s is worse than none.
  const next = (ORDER_TRANSITIONS[order.status as OrderStatusCode] ?? []).filter((s) =>
    canSetStatus(user.role, s),
  );
  const ship = order.shippingAddress;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/orders" className="text-sm font-medium text-sky hover:underline">
          ← Orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-bold tracking-tight">{order.number}</h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="mt-1 text-sm text-ink-3">
          {order.customer.name ? `${order.customer.name} · ` : ""}
          {order.customer.email} · placed {at(order.placedAt ?? order.createdAt)}
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-flame/30 bg-flame/10 px-4 py-3 text-sm text-flame"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-lg border border-line bg-paper">
            <h2 className="border-b border-line bg-paper-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
              Items
            </h2>
            <ul className="divide-y divide-line">
              {order.items.map((item, i) => (
                <li key={i} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-semibold">{item.productName}</span>
                    <span className="inline-flex items-center gap-1.5 text-sm text-ink-3">
                      <span
                        aria-hidden
                        className="inline-block size-3 rounded-full border border-line"
                        style={{ background: item.color.hex }}
                      />
                      {item.color.name}
                    </span>
                    <span className="text-sm text-ink-3">{humanize(item.method)}</span>
                    <span className="ml-auto text-sm font-semibold tabular-nums">
                      {usd(item.lineTotal)}
                    </span>
                  </div>

                  <p className="text-sm text-ink-2">
                    {item.sizes.map((s) => `${s.size}×${s.qty}`).join("  ")}
                    <span className="text-ink-3">
                      {" "}
                      · {item.quantity} units @ {usd(item.unitPrice)}
                    </span>
                  </p>

                  {item.designId ? (
                    <p className="font-mono text-xs text-ink-3">design {item.designId}</p>
                  ) : (
                    <p className="text-xs text-ink-3">blank, no artwork</p>
                  )}
                </li>
              ))}
            </ul>

            <dl className="space-y-1 border-t border-line bg-paper-2 px-4 py-3 text-sm">
              <Row label="Subtotal" value={usd(order.subtotal)} />
              {order.discount > 0 ? <Row label="Discount" value={`−${usd(order.discount)}`} /> : null}
              <Row label="Shipping" value={order.shipping === 0 ? "Free" : usd(order.shipping)} />
              {order.tax > 0 ? <Row label="Tax" value={usd(order.tax)} /> : null}
              <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{usd(order.total)}</dd>
              </div>
            </dl>
          </section>

          <section className="overflow-hidden rounded-lg border border-line bg-paper">
            <h2 className="border-b border-line bg-paper-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
              Timeline
            </h2>
            <ol className="divide-y divide-line">
              {order.timeline.map((event, i) => (
                <li key={i} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                  <StatusBadge status={event.status} />
                  {event.note ? <span className="text-ink-2">{event.note}</span> : null}
                  <span className="ml-auto text-xs text-ink-3">{at(event.at)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-line bg-paper p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-3">
              Advance status
            </h2>

            {next.length === 0 ? (
              // An empty list has two very different causes, and telling staff
              // an order is "final" when it is really "not yours to cancel"
              // would send them hunting for a bug.
              <p className="text-sm text-ink-3" data-testid="no-moves">
                {(ORDER_TRANSITIONS[order.status as OrderStatusCode] ?? []).length === 0
                  ? `${humanize(order.status)} is a final state — nothing left to do here.`
                  : `Moving an order out of ${humanize(order.status)} is limited to owners.`}
              </p>
            ) : (
              <form action={setOrderStatus} className="space-y-3">
                <input type="hidden" name="number" value={order.number} />

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-3">Move to</span>
                  <select
                    name="status"
                    defaultValue={next[0]}
                    className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm"
                  >
                    {next.map((s) => (
                      <option key={s} value={s}>
                        {humanize(s)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-3">
                    Note <span className="font-normal">(optional)</span>
                  </span>
                  <input
                    name="note"
                    maxLength={500}
                    placeholder="Tracking number, reason…"
                    className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm"
                  />
                </label>

                <button
                  type="submit"
                  className="w-full rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-ink-2"
                >
                  Save
                </button>
              </form>
            )}
          </section>

          <section className="rounded-lg border border-line bg-paper p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
              Ship to
            </h2>
            {ship.line1 ? (
              <address className="text-sm not-italic leading-relaxed text-ink-2">
                {ship.name ? (
                  <>
                    {ship.name}
                    <br />
                  </>
                ) : null}
                {ship.line1}
                <br />
                {ship.line2 ? (
                  <>
                    {ship.line2}
                    <br />
                  </>
                ) : null}
                {[ship.city, ship.state, ship.postal].filter(Boolean).join(", ")}
                <br />
                {ship.country}
              </address>
            ) : (
              <p className="text-sm text-ink-3">No address on this order.</p>
            )}
          </section>

          {order.notes ? (
            <section className="rounded-lg border border-line bg-paper p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
                Customer notes
              </h2>
              <p className="whitespace-pre-wrap text-sm text-ink-2">{order.notes}</p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-2">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
