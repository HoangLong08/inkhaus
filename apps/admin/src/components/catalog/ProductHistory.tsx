import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CatalogAuditEntry } from "@/lib/api";
import { at, usd } from "@/lib/format";

/** the API's field names, as a person reads them */
const FIELD_LABEL: Record<string, string> = {
  name: "Name",
  type: "Blank shape",
  category: "Category",
  blurb: "Blurb",
  fabric: "Fabric",
  tag: "Tag",
  sizes: "Sizes",
  price: "Price",
  bulkPrice: "Bulk price",
  methods: "Print methods",
  printArea: "Print area",
  printInches: "Print size (in)",
  colorSlugs: "Colours",
  active: "On sale",
  sortOrder: "Sort order",
};

const MONEY = new Set(["price", "bulkPrice"]);

function show(key: string, value: unknown): string {
  if (MONEY.has(key) && typeof value === "number") return usd(value);
  if (key === "sizes" && Array.isArray(value) && value.length === 0) return "default run";
  if (value === null || value === undefined || value === "") return "none";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([k, v]) => `${k} ${String(v)}`)
      .join(" · ");
  }
  return String(value);
}

/**
 * The product's last ten audit entries (`AuditService.history`), newest first.
 * Server rendered - a save calls `router.refresh()`, which brings the new entry.
 */
export default function ProductHistory({ entries }: { entries: CatalogAuditEntry[] }) {
  return (
    <Card data-testid="product-history">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          History
        </CardTitle>
        <CardDescription>The last ten changes, and who made them.</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No changes recorded since the back office started keeping a log.
          </p>
        ) : (
          <ol className="space-y-4">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="space-y-1 text-sm"
                data-testid="product-history-entry"
                data-action={entry.action}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium">
                    {entry.actor ? (entry.actor.name ?? entry.actor.email) : "A removed account"}
                  </span>
                  <time dateTime={entry.at} className="text-muted-foreground text-xs">
                    {at(entry.at)}
                  </time>
                </div>
                {entry.action === "product.update" && entry.after ? (
                  <dl className="text-muted-foreground space-y-0.5">
                    {Object.keys(entry.after).map((key) => (
                      <div key={key} className="flex flex-wrap gap-x-1.5">
                        <dt className="text-foreground">{FIELD_LABEL[key] ?? key}</dt>
                        <dd className="break-all">
                          {entry.before && key in entry.before ? (
                            <>
                              <span className="line-through">{show(key, entry.before[key])}</span>{" "}
                              →{" "}
                            </>
                          ) : null}
                          {show(key, entry.after?.[key])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-muted-foreground">{entry.summary}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
