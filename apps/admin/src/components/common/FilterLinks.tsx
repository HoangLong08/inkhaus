import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useStatusLabel } from "@/i18n/labels";
import { hrefWith, type Params } from "@/lib/url";

type Props = {
  base: string;
  /** the URL key this row sets */
  param: string;
  values: readonly string[];
  /** the parsed current value; undefined means "All" */
  active?: string;
  /**
   * The page's zod-parsed params. Every other key is kept and `page` is
   * dropped, which is what stops a status chip from throwing away the search.
   */
  params?: Params;
  testId?: string;
  ariaLabel: string;
  /**
   * The link that clears `param`. `null` leaves it out; `undefined` takes the
   * translated default. Neither may be a default parameter any more - the value
   * comes from a hook, and a hook cannot be called in a parameter list.
   */
  allLabel?: string | null;
  /** how a value is shown; the value itself is always on `data-value` */
  label?: (value: string) => string;
};

/**
 * A row of filter chips that are links, shared by every list page.
 *
 * These stay links on purpose. Tabs and ToggleGroup are both client-only and
 * hold their selection in React state, which would cost this row three things
 * it has for free: the deep link (`/orders?status=PAID` is how the overview
 * tiles navigate), `aria-current="page"`, and being server-rendered at all. A
 * filter belongs in the URL.
 *
 * Each link carries `data-param` and `data-value` ("ALL" for the clearing link),
 * and `data-<param>` with the same value, so the status rows keep the
 * `data-status` their tests were written against.
 *
 * `Button asChild` works in a Server Component because Radix's Slot carries no
 * "use client".
 */
export default function FilterLinks({
  base,
  param,
  values,
  active,
  params = {},
  testId = "filter-link",
  ariaLabel,
  allLabel,
  label,
}: Props) {
  const t = useTranslations("Common");
  // Called unconditionally, because `label` used to be a default parameter and a
  // hook cannot live there. The `t.has()` guard inside is what keeps the
  // non-status rows working: `sort_asc` and friends are not in the Status table,
  // so they fall through to humanize() exactly as they did before.
  const statusLabel = useStatusLabel();
  const show = label ?? statusLabel;
  const clearLabel = allLabel === undefined ? t("all") : allLabel;

  const entries: (string | undefined)[] =
    clearLabel === null ? [...values] : [undefined, ...values];

  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {entries.map((value) => {
        const isActive = value === active;
        const dataValue = value ?? "ALL";
        // a computed data-* name cannot be written as a JSX attribute
        const mirror = { [`data-${param.toLowerCase()}`]: dataValue } as object;

        return (
          <Button
            key={dataValue}
            asChild
            size="sm"
            variant={isActive ? "default" : "outline"}
            // h-8 like every other control; `rounded-full` stays, because a
            // filter chip should not read as one more toolbar button
            className="h-8 rounded-full px-3 text-xs font-semibold"
          >
            <Link
              href={hrefWith(base, params, { [param]: value })}
              aria-current={isActive ? "page" : undefined}
              data-testid={testId}
              data-param={param}
              data-value={dataValue}
              {...mirror}
            >
              {value === undefined ? clearLabel : show(value)}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
