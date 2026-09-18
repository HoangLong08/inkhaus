"use client";

import { unitPrice, type Tier } from "@inkhaus/shared/pricing";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { pct, usd } from "@/lib/format";

/** a product to price the ladder against - the preview needs its price and floor */
export type TierSample = { slug: string; name: string; price: number; bulkPrice: number };

/**
 * What one unit costs at each tier for a real product, computed with the same
 * `unitPrice` checkout uses. `tiers` is null while the ladder being edited is
 * invalid - pricing an unordered ladder would show numbers checkout never
 * would.
 */
export default function TierPreview({
  tiers,
  products,
  description,
}: {
  tiers: Tier[] | null;
  products: TierSample[];
  /** the read-only ladder says who may change it; left out, the plain hint */
  description?: string;
}) {
  // not a default parameter any more: the fallback comes from a hook, and a
  // hook cannot be called in a parameter list - the same move FilterLinks made
  // with `allLabel`
  const t = useTranslations("Tiers");
  const [slug, setSlug] = useState(products[0]?.slug);
  const sample = products.find((p) => p.slug === slug) ?? products[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          {t("preview.title")}
        </CardTitle>
        <CardDescription>{description ?? t("preview.hint")}</CardDescription>
        {sample ? (
          <CardAction>
            <Label htmlFor="tiers-sample" className="sr-only">
              {t("preview.product")}
            </Label>
            <Select value={sample.slug} onValueChange={setSlug}>
              <SelectTrigger id="tiers-sample" className="w-48" data-testid="tiers-sample">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.slug} value={p.slug} data-testid="tiers-sample-option" data-slug={p.slug}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {!sample ? (
          <p className="text-muted-foreground text-sm">{t("preview.none")}</p>
        ) : !tiers ? (
          <p className="text-muted-foreground text-sm">{t("preview.invalid")}</p>
        ) : (
          <Table data-testid="tiers-preview">
            <TableHeader>
              <TableRow>
                <TableHead>{t("preview.from")}</TableHead>
                <TableHead className="text-right">{t("preview.discount")}</TableHead>
                <TableHead className="text-right">{t("preview.unitPrice")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((tier) => {
                // the floor wins whenever the discounted price would undercut it
                const floored = sample.price * (1 - tier.off) < sample.bulkPrice;
                return (
                  <TableRow key={tier.min} data-min={tier.min}>
                    <TableCell className="tabular-nums">{tier.min}+</TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {tier.off === 0 ? "—" : pct(tier.off)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="inline-flex items-center gap-2">
                        {floored ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            {t("preview.floor")}
                          </Badge>
                        ) : null}
                        {usd(unitPrice(sample, tier.min, tiers))}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
