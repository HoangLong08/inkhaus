"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { CATEGORY_LABEL, COLORS, PRODUCTS, type ProductCategory } from "@/lib/catalog";
import {
  EMPTY,
  SORTS,
  activeColorKeys,
  activeCount,
  activeMethods,
  activeCategories,
  countFor,
  type FilterState,
  type SortKey,
} from "@/lib/productFilter";

const CATS = activeCategories();
const METHODS = activeMethods();
const COLOR_KEYS = activeColorKeys();

export default function ProductFilters({
  value,
  onChange,
  resultCount,
  open,
  onToggle,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  resultCount: number;
  /** mobile sheet state — the desktop bar is always visible */
  open: boolean;
  onToggle: () => void;
}) {
  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    onChange({ ...value, [k]: v });

  /** clicking the active pill clears it, which is what a toggle should do */
  const toggle = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    set(k, (value[k] === v ? "" : v) as FilterState[K]);

  const n = activeCount(value);

  return (
    <div className="edge border-b hairline py-6">
      {/* search + sort + the mobile sheet trigger */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex min-w-0 flex-1 items-center sm:max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-4 text-ink/35" />
          <input
            data-testid="products-search"
            type="search"
            value={value.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Search blanks, fabrics, methods…"
            aria-label="Search blanks"
            className="w-full rounded-full border hairline bg-paper-2 py-3 pl-11 pr-4 text-[14px] outline-none transition placeholder:text-ink/35 focus:border-ink/30 focus:bg-paper"
          />
        </label>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex items-center gap-2 rounded-full border hairline px-4 py-3 text-[12px] font-bold uppercase tracking-[0.12em] text-ink/60 transition hover:border-ink hover:text-ink lg:hidden"
        >
          <SlidersHorizontal size={14} />
          Filters
          {n > 0 && (
            <span className="grid h-5 w-5 place-items-center rounded-full bg-acid text-[10px] text-ink">
              {n}
            </span>
          )}
        </button>

        <label className="ml-auto flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-ink/40">
          <span className="hidden sm:inline">Sort</span>
          <select
            data-testid="products-sort"
            value={value.sort}
            onChange={(e) => set("sort", e.target.value as SortKey)}
            aria-label="Sort blanks"
            className="rounded-full border hairline bg-paper-2 px-4 py-3 text-[13px] normal-case tracking-normal text-ink outline-none transition hover:bg-paper-3 focus:border-ink/30"
          >
            {Object.entries(SORTS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* the facets. Always shown from lg up; a sheet below it. */}
      <div className={`${open ? "block" : "hidden"} mt-6 space-y-5 lg:block`}>
        <Row label="Category">
          <Pill active={!value.cat} onClick={() => set("cat", "")} testid="products-filter-cat-all">
            Everything
            <Count n={PRODUCTS.length} />
          </Pill>
          {CATS.map((c: ProductCategory) => (
            <Pill
              key={c}
              active={value.cat === c}
              onClick={() => toggle("cat", c)}
              testid={`products-filter-cat-${c}`}
            >
              {CATEGORY_LABEL[c]}
              <Count n={countFor(PRODUCTS, c)} />
            </Pill>
          ))}
        </Row>

        <Row label="Print method">
          {METHODS.map((m) => (
            <Pill
              key={m}
              active={value.method === m}
              onClick={() => toggle("method", m)}
              testid={`products-filter-method-${m.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {m}
            </Pill>
          ))}
        </Row>

        <Row label="Colour">
          <div className="flex flex-wrap items-center gap-2">
            {COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                data-testid={`products-filter-color-${key}`}
                onClick={() => toggle("color", key)}
                aria-label={COLORS[key].name}
                aria-pressed={value.color === key}
                title={COLORS[key].name}
                className={`h-8 w-8 rounded-full border-2 transition hover:scale-110 ${
                  value.color === key ? "border-acid-2 scale-110" : "border-ink/15"
                }`}
                style={{ background: COLORS[key].hex }}
              />
            ))}
          </div>
        </Row>
      </div>

      {/* what is on, and the count it produced */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span data-testid="products-count" data-count={resultCount} className="text-[12px] text-ink/45">
          {resultCount} {resultCount === 1 ? "blank" : "blanks"}
        </span>

        {value.cat && (
          <Chip onClear={() => set("cat", "")}>{CATEGORY_LABEL[value.cat]}</Chip>
        )}
        {value.method && <Chip onClear={() => set("method", "")}>{value.method}</Chip>}
        {value.color && <Chip onClear={() => set("color", "")}>{COLORS[value.color].name}</Chip>}
        {value.q && <Chip onClear={() => set("q", "")}>&ldquo;{value.q}&rdquo;</Chip>}

        {n > 0 && (
          <button
            type="button"
            data-testid="products-clear"
            onClick={() => onChange({ ...EMPTY, sort: value.sort })}
            className="ml-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink/40 underline-offset-4 hover:text-flame hover:underline"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="w-full text-[10px] font-bold uppercase tracking-[0.18em] text-ink/35 sm:w-28">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
  testid,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testid: string;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold transition ${
        active ? "bg-ink text-paper" : "bg-paper-2 text-ink/60 hover:bg-paper-3 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

const Count = ({ n }: { n: number }) => <span className="text-[10px] opacity-50">{n}</span>;

function Chip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border hairline bg-paper-2 py-1 pl-3 pr-1.5 text-[11px] text-ink/60">
      {children}
      <button
        type="button"
        onClick={onClear}
        aria-label="Remove this filter"
        className="grid h-5 w-5 place-items-center rounded-full transition hover:bg-paper-3 hover:text-flame"
      >
        <X size={11} />
      </button>
    </span>
  );
}
