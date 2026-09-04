"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Loader2, Lock, ShoppingBag, WifiOff } from "lucide-react";
import LineThumb from "@/components/cart/LineThumb";
import { FreeShippingMeter } from "@/components/cart/Meters";
import { ApiError, api, type PlaceOrderBody } from "@/lib/api";
import { METHOD_ENUM, readCart, useCart, type ResolvedLine } from "@/lib/cart";
import { dropPendingDesign, getPendingDesign } from "@/lib/cart-designs";
import { rememberOrder } from "@/lib/recent-orders";
import { useOnlineStatus } from "@/lib/use-online-status";
import { useSession } from "@/lib/use-session";
import { useStoredValue, writeStoredValue } from "@/lib/use-stored-value";

/* ---------------- the form ---------------- */

type Fields = {
  email: string;
  name: string;
  phone: string;
  company: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal: string;
  notes: string;
};

const EMPTY: Fields = {
  email: "",
  name: "",
  phone: "",
  company: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal: "",
  notes: "",
};

const DETAILS_KEY = "inkhaus-checkout-v1";

/** deliberately loose — the server is the authority, this only catches typos */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(f: Fields): Partial<Record<keyof Fields, string>> {
  const errors: Partial<Record<keyof Fields, string>> = {};
  if (!f.email.trim()) errors.email = "We send the proof and the tracking number here.";
  else if (!EMAIL.test(f.email.trim())) errors.email = "That does not look like an email address.";
  if (!f.name.trim()) errors.name = "Who should we address the box to?";
  if (!f.line1.trim()) errors.line1 = "Street address is required.";
  if (!f.city.trim()) errors.city = "City is required.";
  if (!f.state.trim()) errors.state = "State is required.";
  else if (!/^[A-Za-z]{2}$/.test(f.state.trim())) errors.state = "Use the two-letter state code.";
  if (!f.postal.trim()) errors.postal = "ZIP is required.";
  else if (!/^\d{5}(-\d{4})?$/.test(f.postal.trim())) errors.postal = "US ZIP, e.g. 90013.";
  if (f.notes.length > 1000) errors.notes = "Keep it under 1,000 characters.";
  return errors;
}

export default function CheckoutForm() {
  const router = useRouter();
  const online = useOnlineStatus();

  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const clear = useCart((s) => s.clear);
  const markDesignSaved = useCart((s) => s.markDesignSaved);

  const { lines: resolved, totals } = useMemo(() => readCart(lines), [lines]);

  // Remembered between visits: a failed attempt or an accidental reload should
  // not cost the customer their address a second time. Nothing sensitive here —
  // no payment details are collected in this build. The note is deliberately not
  // carried over; it belongs to one order.
  const savedRaw = useStoredValue(DETAILS_KEY);
  const saved = useMemo<Fields | null>(() => {
    if (!savedRaw) return null;
    try {
      return { ...EMPTY, ...JSON.parse(savedRaw), notes: "" };
    } catch {
      return null;
    }
  }, [savedRaw]);

  const [edited, setEdited] = useState<Fields | null>(null);
  const fields = edited ?? saved ?? EMPTY;

  /**
   * Fill blanks from the signed-in account - once, and only blanks.
   *
   * Deliberately a one-shot effect rather than a value derived from the
   * session. The session arrives over the network, so a derived value would
   * re-render this controlled form at an arbitrary moment, and if that moment
   * lands mid-keystroke the browser appends rather than replaces: the shopper
   * ends up staring at "you@example.comwhatever-they-typed". Seeding once, into
   * whatever is still empty, cannot fight the person filling the form in.
   *
   * "Only blanks" is the other half: someone sending a run to a workplace or as
   * a gift typed that other address on purpose, and their own account must not
   * overwrite it.
   */
  const { customer } = useSession();
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !customer) return;
    prefilled.current = true;

    setEdited((current) => {
      const start = current ?? saved ?? EMPTY;
      return {
        ...start,
        email: start.email || customer.email,
        name: start.name || customer.name || "",
      };
    });
  }, [customer, saved]);

  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState<null | "artwork" | "order">(null);
  const [failure, setFailure] = useState<{ message: string; detail: string[] } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const set = (key: keyof Fields, value: string) => {
    const next = { ...fields, [key]: value };
    setEdited(next);
    if (touched) setErrors(validate(next));
    writeStoredValue(DETAILS_KEY, JSON.stringify({ ...next, notes: "" }));
  };

  /**
   * Artwork first, order second.
   *
   * A design only becomes orderable once `POST /designs` has given it a public
   * id, and that call is attempted when the line is added. If it did not land
   * then — the API was down, which this storefront is built to survive — the
   * payload was parked in IndexedDB and this is the retry. An order that quietly
   * went to press without the customer's artwork would be far worse than a
   * blocked checkout, so a failure here stops the submit.
   */
  async function attachDesigns(items: ResolvedLine[]) {
    for (const line of items) {
      if (!line.design || line.design.publicId) continue;

      const pending = await getPendingDesign(line.design.key);
      if (!pending) {
        throw new ApiError(
          0,
          `The artwork for the ${line.product.name} is no longer saved on this device.`,
          [
            "Open the studio, rebuild or re-upload that design, and add it to the cart again — " +
              "or remove the line to order the blank on its own.",
          ],
        );
      }

      const { publicId } = await api.saveDesign({
        productSlug: pending.productSlug,
        colorSlug: pending.colorSlug,
        name: pending.name,
        scene: pending.scene,
        previewFront: pending.previewFront,
        previewBack: pending.previewBack,
        email: fields.email.trim() || undefined,
      });

      markDesignSaved(line.id, publicId);
      line.design = { ...line.design, publicId };
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setFailure(null);

    const found = validate(fields);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']");
      first?.focus();
      first?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (resolved.length === 0) return;

    try {
      setBusy("artwork");
      await attachDesigns(resolved);

      setBusy("order");
      const body: PlaceOrderBody = {
        customer: {
          email: fields.email.trim(),
          name: fields.name.trim() || undefined,
          phone: fields.phone.trim() || undefined,
          company: fields.company.trim() || undefined,
        },
        items: resolved.map((line) => ({
          productSlug: line.productSlug,
          colorSlug: line.colorSlug,
          method: METHOD_ENUM[line.method],
          designId: line.design?.publicId,
          sizes: line.entries,
        })),
        shipping: {
          name: fields.name.trim(),
          line1: fields.line1.trim(),
          line2: fields.line2.trim() || undefined,
          city: fields.city.trim(),
          state: fields.state.trim().toUpperCase(),
          postal: fields.postal.trim(),
          country: "US",
        },
        notes: fields.notes.trim() || undefined,
      };

      const order = await api.placeOrder(body);

      rememberOrder({
        number: order.number,
        total: order.total,
        quantity: order.items.reduce((n, i) => n + i.quantity, 0),
        placedAt: Date.now(),
      });
      await Promise.all(
        resolved.map((l) => (l.design ? dropPendingDesign(l.design.key) : Promise.resolve())),
      );
      clear();
      router.replace(`/orders/${encodeURIComponent(order.number)}?placed=1`);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      setFailure({
        message: apiErr?.message ?? "Something went wrong placing the order.",
        detail: apiErr?.detail.slice(1) ?? [],
      });
      setBusy(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // The cart arrives from localStorage a beat after the first paint. Rendering
  // a $0.00 summary in the meantime reads as a lost cart.
  if (!hydrated) {
    return (
      <div className="pt-[calc(var(--nav-h)+50px)]">
        <div className="edge grid gap-10 py-16 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)]">
          <div className="space-y-4" aria-hidden>
            <div className="h-10 w-1/3 animate-pulse rounded bg-paper-2" />
            <div className="h-64 animate-pulse rounded-2xl bg-paper-2" />
          </div>
          <div className="h-80 animate-pulse rounded-3xl bg-paper-2" aria-hidden />
          <span className="sr-only">Loading your cart…</span>
        </div>
      </div>
    );
  }

  if (resolved.length === 0 && !busy) {
    return (
      <div className="pt-[calc(var(--nav-h)+50px)]">
        <div className="edge flex flex-col items-center gap-6 py-28 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-paper-2 text-ink/25">
            <ShoppingBag size={30} />
          </span>
          <div>
            <h1 className="display text-[clamp(2rem,6vw,3.2rem)]">Nothing to check out</h1>
            <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-ink/50">
              Your cart is empty. Add a blank or a design and the checkout will be waiting.
            </p>
          </div>
          <Link
            href="/products"
            className="rounded-full bg-acid px-7 py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-ink"
          >
            Shop blanks
          </Link>
        </div>
      </div>
    );
  }

  const working = busy !== null;

  return (
    <div className="pt-[calc(var(--nav-h)+50px)]">
      <div className="edge pb-24">
        <header className="border-b hairline pb-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-acid-2">Step 2 of 2</p>
          <h1 className="display mt-4 text-[clamp(2.6rem,8vw,5.5rem)]">Checkout</h1>
          <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-ink/50">
            No card is taken here. You place the order, we send a free digital proof within two
            hours, and payment happens once you have approved it.
          </p>
        </header>

        {failure && (
          <div
            role="alert"
            className="mt-8 flex items-start gap-3 rounded-2xl border border-flame/40 bg-flame/10 px-5 py-4 text-[13px] text-flame"
          >
            <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">{failure.message}</p>
              {failure.detail.length > 0 && (
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-flame/85">
                  {failure.detail.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-flame/75">
                Your cart is untouched — nothing was charged and nothing was lost.
              </p>
            </div>
          </div>
        )}

        {!online && (
          <div
            role="status"
            className="mt-8 flex items-center gap-3 rounded-2xl border hairline bg-paper-2 px-5 py-4 text-[13px] text-ink/60"
          >
            <WifiOff size={16} className="shrink-0" aria-hidden />
            You are offline. The cart is saved on this device — the order can be placed as soon as
            you are back.
          </div>
        )}

        <div className="grid gap-10 pt-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)] lg:gap-14">
          <form ref={formRef} id="checkout-form" onSubmit={submit} noValidate>
            <fieldset disabled={working} className="space-y-10 disabled:opacity-60">
              <section>
                <h2 className="display text-[24px]">Contact</h2>
                <p className="mt-1.5 text-[12px] text-ink/45">
                  The proof, the invoice and the tracking number all go to this address.
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field
                    id="email"
                    label="Email"
                    type="email"
                    required
                    autoComplete="email"
                    value={fields.email}
                    error={errors.email}
                    onChange={(v) => set("email", v)}
                  />
                  <Field
                    id="name"
                    label="Full name"
                    required
                    autoComplete="name"
                    value={fields.name}
                    error={errors.name}
                    onChange={(v) => set("name", v)}
                  />
                  <Field
                    id="phone"
                    label="Phone"
                    type="tel"
                    autoComplete="tel"
                    hint="Only for delivery problems"
                    value={fields.phone}
                    error={errors.phone}
                    onChange={(v) => set("phone", v)}
                  />
                  <Field
                    id="company"
                    label="Company or team"
                    autoComplete="organization"
                    hint="Optional"
                    value={fields.company}
                    error={errors.company}
                    onChange={(v) => set("company", v)}
                  />
                </div>
              </section>

              <section>
                <h2 className="display text-[24px]">Shipping address</h2>
                <p className="mt-1.5 text-[12px] text-ink/45">
                  US delivery only in this build — everything ships from Los Angeles or Charlotte.
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field
                    id="line1"
                    label="Street address"
                    required
                    autoComplete="address-line1"
                    className="sm:col-span-2"
                    value={fields.line1}
                    error={errors.line1}
                    onChange={(v) => set("line1", v)}
                  />
                  <Field
                    id="line2"
                    label="Apartment, suite, floor"
                    autoComplete="address-line2"
                    hint="Optional"
                    className="sm:col-span-2"
                    value={fields.line2}
                    error={errors.line2}
                    onChange={(v) => set("line2", v)}
                  />
                  <Field
                    id="city"
                    label="City"
                    required
                    autoComplete="address-level2"
                    value={fields.city}
                    error={errors.city}
                    onChange={(v) => set("city", v)}
                  />
                  <div className="grid grid-cols-[1fr_1.3fr] gap-4">
                    <Field
                      id="state"
                      label="State"
                      required
                      maxLength={2}
                      autoComplete="address-level1"
                      placeholder="CA"
                      value={fields.state}
                      error={errors.state}
                      onChange={(v) => set("state", v.toUpperCase())}
                    />
                    <Field
                      id="postal"
                      label="ZIP"
                      required
                      inputMode="numeric"
                      autoComplete="postal-code"
                      placeholder="90013"
                      value={fields.postal}
                      error={errors.postal}
                      onChange={(v) => set("postal", v)}
                    />
                  </div>
                </div>
              </section>

              <section>
                <h2 className="display text-[24px]">Anything we should know?</h2>
                <p className="mt-1.5 text-[12px] text-ink/45">
                  Event dates, Pantone references, roster files — the press operator reads this.
                </p>
                <textarea
                  id="notes"
                  rows={4}
                  maxLength={1000}
                  value={fields.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  aria-invalid={!!errors.notes}
                  className="mt-4 w-full rounded-2xl border hairline bg-paper-2 p-4 text-[14px] outline-none transition focus:border-acid-2"
                />
                <p className="mt-1 text-right text-[11px] text-ink/35">{fields.notes.length}/1000</p>
              </section>
            </fieldset>
          </form>

          <aside className="lg:sticky lg:top-[calc(var(--nav-h)+40px)] lg:h-fit">
            <div className="rounded-3xl border hairline bg-paper-2 p-6">
              <h2 className="display text-[22px]">
                Order summary
                <span className="ml-2 text-[13px] font-normal tracking-normal text-ink/40">
                  {totals.quantity} {totals.quantity === 1 ? "piece" : "pieces"}
                </span>
              </h2>

              <ul className="mt-5 max-h-[300px] space-y-3 overflow-y-auto border-t hairline pt-5">
                {resolved.map((line) => (
                  <li key={line.id} className="flex gap-3">
                    <LineThumb line={line} className="h-16 w-12 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{line.product.name}</p>
                      <p className="text-[11px] text-ink/45">
                        {line.color.name} · {line.method}
                        {line.design ? " · custom" : ""}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink/45">
                        {line.entries.map((e) => `${e.size}×${e.qty}`).join("  ")}
                      </p>
                    </div>
                    <p className="shrink-0 text-[13px] font-semibold tabular-nums">
                      ${line.quote.subtotal.toFixed(2)}
                    </p>
                  </li>
                ))}
              </ul>

              <dl className="mt-5 space-y-2 border-t hairline pt-5 text-[14px]">
                <div className="flex justify-between">
                  <dt className="text-ink/50">Subtotal</dt>
                  <dd className="tabular-nums">${totals.subtotal.toFixed(2)}</dd>
                </div>
                {totals.savings > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-ink/50">Volume discount</dt>
                    <dd className="tabular-nums text-acid-2">− ${totals.savings.toFixed(2)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-ink/50">Shipping</dt>
                  <dd className="tabular-nums">
                    {totals.shipping === 0 ? "Free" : `$${totals.shipping.toFixed(2)}`}
                  </dd>
                </div>
                {totals.tax > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-ink/50">Tax</dt>
                    <dd className="tabular-nums">${totals.tax.toFixed(2)}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-5 flex items-end justify-between border-t hairline pt-5">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink/40">
                  Total
                </span>
                <span className="display text-[clamp(2rem,5vw,2.8rem)] leading-none tabular-nums">
                  ${totals.total.toFixed(2)}
                </span>
              </div>

              <div className="mt-5">
                <FreeShippingMeter subtotal={totals.subtotal} />
              </div>

              {/* The summary sits outside the <form> in the layout, so the button
                  is wired back to it by id — Enter in a text field and a click
                  here then take the same path. */}
              <button
                type="submit"
                form="checkout-form"
                disabled={working || !online || resolved.length === 0}
                data-testid="place-order"
                className="group mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-acid py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-ink transition hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-acid disabled:hover:text-ink"
              >
                {working ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                    {busy === "artwork" ? "Saving your artwork…" : "Placing the order…"}
                  </>
                ) : (
                  <>
                    Place the order
                    <ArrowRight
                      size={16}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </>
                )}
              </button>

              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink/40">
                <Lock size={12} aria-hidden /> No payment details are taken on this screen.
              </p>
              <Link
                href="/cart"
                className="mt-4 block text-center text-[12px] font-bold uppercase tracking-[0.14em] text-ink/45 hover:text-ink"
              >
                ← Back to cart
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ---------------- one labelled input ---------------- */

function Field({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  required,
  type = "text",
  className = "",
  ...rest
}: {
  id: keyof Fields | string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  type?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange" | "type">) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="flex items-baseline justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45"
      >
        <span>
          {label}
          {required && <span className="ml-1 text-flame">*</span>}
        </span>
        {hint && !error && <span className="font-normal normal-case tracking-normal text-ink/30">{hint}</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-2 w-full rounded-xl border bg-paper-2 px-4 py-3 text-[14px] outline-none transition focus:border-acid-2 ${
          error ? "border-flame" : "hairline"
        }`}
        {...rest}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[11px] text-flame">
          {error}
        </p>
      )}
    </div>
  );
}
