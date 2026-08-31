"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProductCard from "@/components/products/ProductCard";
import ProductFilters from "@/components/products/ProductFilters";
import QuickView from "@/components/products/QuickView";
import { PRODUCTS, type Product } from "@/lib/catalog";
import { applyFilters, parseFilters, toQuery, type FilterState } from "@/lib/productFilter";

/**
 * /products, with the filter state living in the URL.
 *
 * The URL is the source of truth for everything except the search box, which
 * keeps a local value so typing stays responsive and only writes to the URL once
 * the user pauses. That means back/forward work, a filtered view is a shareable
 * link, and a cold load of ?cat=drinkware&sort=price-asc renders correctly.
 *
 * Must be rendered inside <Suspense> — useSearchParams would otherwise opt the
 * whole route out of static rendering.
 */
export default function ProductBrowser() {
  const router = useRouter();
  const params = useSearchParams();

  const url = useMemo(() => parseFilters(new URLSearchParams(params.toString())), [params]);
  const [draftQ, setDraftQ] = useState(url.q);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quick, setQuick] = useState<Product | null>(null);

  // a URL change from outside this component (back button, a category link on
  // the homepage) has to win over whatever is half-typed in the box
  const lastPushed = useRef(url.q);
  useEffect(() => {
    if (url.q !== lastPushed.current) {
      lastPushed.current = url.q;
      setDraftQ(url.q);
    }
  }, [url.q]);

  const push = useCallback(
    (next: FilterState) => {
      lastPushed.current = next.q;
      const qs = toQuery(next);
      // replace, not push: a filter tweak is not a page the back button should
      // have to walk through one keystroke at a time
      router.replace(qs ? `/products?${qs}` : "/products", { scroll: false });
    },
    [router],
  );

  const onChange = useCallback(
    (next: FilterState) => {
      setDraftQ(next.q);
      push(next);
    },
    [push],
  );

  // debounce only the text box; pills and the sort select are immediate
  useEffect(() => {
    if (draftQ === url.q) return;
    const t = setTimeout(() => push({ ...url, q: draftQ }), 250);
    return () => clearTimeout(t);
  }, [draftQ, url, push]);

  const state = { ...url, q: draftQ };
  const results = useMemo(() => applyFilters(PRODUCTS, { ...url, q: draftQ }), [url, draftQ]);

  return (
    <>
      <ProductFilters
        value={state}
        onChange={onChange}
        resultCount={results.length}
        open={sheetOpen}
        onToggle={() => setSheetOpen((v) => !v)}
      />

      {results.length === 0 ? (
        <div data-testid="products-empty" className="edge py-28 text-center">
          <p className="display text-[clamp(1.8rem,5vw,3rem)]">Nothing matches.</p>
          <p className="mx-auto mt-4 max-w-sm text-[14px] leading-relaxed text-ink/50">
            No blank fits those filters. Widen them, or clear them and start again.
          </p>
          <button
            type="button"
            onClick={() => onChange({ q: "", cat: "", color: "", method: "", sort: url.sort })}
            className="mt-7 rounded-full bg-acid px-7 py-4 text-[13px] font-bold uppercase tracking-[0.14em] text-ink transition hover:brightness-95"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="edge grid gap-x-6 gap-y-16 py-16 md:grid-cols-2 lg:grid-cols-3">
          {results.map((p, i) => (
            <ProductCard
              key={p.slug}
              p={p}
              i={i}
              onQuickView={setQuick}
              // the reveal animation is for a first read of the page; replaying
              // it on every keystroke of a search reads as flicker
              reveal={!draftQ}
              preload={i === 0}
            />
          ))}
        </div>
      )}

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </>
  );
}
