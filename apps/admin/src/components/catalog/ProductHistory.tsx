import { useTranslations } from "next-intl";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CatalogAuditEntry } from "@/lib/api";
import { at, usd } from "@/lib/format";

const MONEY = new Set(["price", "bulkPrice"]);

/** what a translator has to be able to answer for `show` below */
type Words = {
  defaultRun: string;
  none: string;
  yes: string;
  no: string;
};

function show(key: string, value: unknown, words: Words): string {
  if (MONEY.has(key) && typeof value === "number") return usd(value);
  if (key === "sizes" && Array.isArray(value) && value.length === 0) return words.defaultRun;
  if (value === null || value === undefined || value === "") return words.none;
  if (typeof value === "boolean") return value ? words.yes : words.no;
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
  const t = useTranslations("Product");
  // the API's field names, as a person reads them. `t.has` because the field
  // list is the API's, not ours - it is a separate deployment (s3.4) and a key
  // this build has never heard of has to render as something.
  const field = (key: string) =>
    t.has(`field.${key}` as "field.name") ? t(`field.${key}` as "field.name") : key;
  const words = {
    defaultRun: t("history.defaultRun"),
    none: t("history.none"),
    yes: t("history.yes"),
    no: t("history.no"),
  };

  return (
    <Card data-testid="product-history">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          {t("history.title")}
        </CardTitle>
        <CardDescription>{t("history.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("history.empty")}
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
                    {entry.actor ? (entry.actor.name ?? entry.actor.email) : t("history.removedActor")}
                  </span>
                  <time dateTime={entry.at} className="text-muted-foreground text-xs">
                    {at(entry.at)}
                  </time>
                </div>
                {entry.action === "product.update" && entry.after ? (
                  <dl className="text-muted-foreground space-y-0.5">
                    {Object.keys(entry.after).map((key) => (
                      <div key={key} className="flex flex-wrap gap-x-1.5">
                        <dt className="text-foreground">{field(key)}</dt>
                        <dd className="break-all">
                          {entry.before && key in entry.before ? (
                            <>
                              <span className="line-through">{show(key, entry.before[key], words)}</span>{" "}
                              →{" "}
                            </>
                          ) : null}
                          {show(key, entry.after?.[key], words)}
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
