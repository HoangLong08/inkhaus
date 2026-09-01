import Link from "next/link";

import { setQuoteStatus } from "@/app/actions";
import StatusBadge from "@/components/StatusBadge";
import { adminApi, type QuoteStatus } from "@/lib/api";
import { at, humanize, usd } from "@/lib/format";

export const metadata = { title: "Bulk quotes — INKHAUS Back Office" };

const STATUSES: QuoteStatus[] = ["NEW", "CONTACTED", "WON", "LOST"];

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; error?: string }>;
}) {
  const params = await searchParams;
  const status = STATUSES.includes(params.status as QuoteStatus)
    ? (params.status as QuoteStatus)
    : undefined;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const { data, meta } = await adminApi.quotes({ page, status });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Bulk quotes</h1>
        <p className="text-sm text-ink-3">
          {meta.total} total · page {meta.page} of {meta.pages}
        </p>
      </div>

      <nav className="flex flex-wrap gap-1.5">
        <Chip href="/quotes" active={!status}>
          All
        </Chip>
        {STATUSES.map((s) => (
          <Chip key={s} href={`/quotes?status=${s}`} active={status === s}>
            <StatusBadge status={s} />
          </Chip>
        ))}
      </nav>

      {params.error ? (
        <p
          role="alert"
          className="rounded-lg border border-flame/30 bg-flame/10 px-4 py-3 text-sm text-flame"
        >
          {params.error}
        </p>
      ) : null}

      {data.length === 0 ? (
        <p className="rounded-lg border border-line bg-paper p-6 text-sm text-ink-3">
          No quotes match this filter.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.map((quote) => (
            <li key={quote.id} className="rounded-lg border border-line bg-paper p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <a
                  href={`mailto:${quote.email}`}
                  className="font-semibold text-sky hover:underline"
                >
                  {quote.email}
                </a>
                {quote.name ? <span className="text-sm text-ink-2">{quote.name}</span> : null}
                {quote.company ? (
                  <span className="text-sm text-ink-3">{quote.company}</span>
                ) : null}
                <StatusBadge status={quote.status} />
                <span className="ml-auto text-xs text-ink-3">{at(quote.createdAt)}</span>
              </div>

              <p className="mt-2 text-sm text-ink-2">
                <span className="font-semibold tabular-nums">{quote.quantity}</span> units
                {quote.productSlug ? ` · ${quote.productSlug}` : " · no blank chosen"}
                {quote.method ? ` · ${humanize(quote.method)}` : ""}
                {quote.estimated !== null ? (
                  <>
                    {" "}
                    · quoted{" "}
                    <span className="font-semibold tabular-nums">{usd(quote.estimated)}</span>
                  </>
                ) : null}
              </p>

              {quote.message ? (
                <p className="mt-2 whitespace-pre-wrap rounded-md bg-paper-2 px-3 py-2 text-sm text-ink-2">
                  {quote.message}
                </p>
              ) : null}

              <form action={setQuoteStatus} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={quote.id} />
                <label className="text-xs font-medium text-ink-3" htmlFor={`s-${quote.id}`}>
                  Move to
                </label>
                <select
                  id={`s-${quote.id}`}
                  name="status"
                  defaultValue={quote.status}
                  className="rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold transition hover:bg-paper-2"
                >
                  Save
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {meta.pages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          {meta.page > 1 ? (
            <Link
              href={`/quotes?${new URLSearchParams({ ...(status ? { status } : {}), page: String(meta.page - 1) })}`}
              className="font-medium text-sky hover:underline"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {meta.page < meta.pages ? (
            <Link
              href={`/quotes?${new URLSearchParams({ ...(status ? { status } : {}), page: String(meta.page + 1) })}`}
              className="font-medium text-sky hover:underline"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full border px-2 py-1 text-xs font-semibold transition ${
        active ? "border-ink bg-ink text-paper" : "border-line bg-paper hover:bg-paper-2"
      }`}
    >
      {children}
    </Link>
  );
}
