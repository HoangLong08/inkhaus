"use client";

import { can } from "@inkhaus/shared/admin";
import type { AdminRoleCode } from "@inkhaus/shared/orders";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Palette } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import ColorDialog from "@/components/catalog/ColorDialog";
import ListEmpty from "@/components/common/ListEmpty";
import { OrdinalCell, OrdinalHead } from "@/components/common/Ordinal";
import TableCard from "@/components/common/TableCard";
import StatusBadge from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CatalogColor } from "@/lib/api";
import { ClientApiError, clientApi } from "@/lib/client-api";
import { count } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

/**
 * Every colour, archived included. Hydrated by the page; the active switch
 * writes optimistically, because archiving is one click and a round trip of a
 * frozen switch reads as a hung app.
 */
export default function ColorsTable({ role }: { role: AdminRoleCode }) {
  const t = useTranslations("Colors");
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = queryKeys.catalog.colors();
  const canEdit = can(role, "catalog.edit");

  const { data: colors = [] } = useQuery({
    queryKey: key,
    queryFn: () => clientApi.catalog.colors(),
  });

  const toggle = useMutation({
    mutationFn: ({ slug, active }: { slug: string; active: boolean }) =>
      clientApi.catalog.updateColor(slug, { active }),

    onMutate: async ({ slug, active }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CatalogColor[]>(key);
      queryClient.setQueryData<CatalogColor[]>(key, (list = []) =>
        list.map((c) => (c.slug === slug ? { ...c, active } : c)),
      );
      return { previous };
    },

    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      if (error instanceof ClientApiError && error.status === 401) return;
      toast.error(t("toggle.error"), { description: error.message });
    },

    onSuccess: (next) => {
      queryClient.setQueryData<CatalogColor[]>(key, (list = []) =>
        list.map((c) => (c.slug === next.slug ? next : c)),
      );
      toast.success(
        next.active
          ? t("toggle.offered", { name: next.name })
          : t("toggle.archived", { name: next.name }),
      );
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all() });
      // the archived count in the page header is server rendered
      router.refresh();
    },
  });

  if (colors.length === 0) {
    return (
      <ListEmpty
        icon={Palette}
        title={t("empty.title")}
        description={t("empty.description")}
        reason="none"
      />
    );
  }

  return (
    <TableCard fill>
      <Table>
        <TableHeader>
          <TableRow>
            <OrdinalHead />
            <TableHead>{t("columns.colour")}</TableHead>
            <TableHead>{t("columns.slug")}</TableHead>
            <TableHead>{t("columns.hex")}</TableHead>
            <TableHead className="text-right">{t("columns.products")}</TableHead>
            <TableHead className="text-right">{t("columns.orderLines")}</TableHead>
            <TableHead>{t("columns.offered")}</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">{t("columns.edit")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* the list is the API's own order and nothing re-sorts or filters it
              here - archiving only maps a row in place - so the index is the
              display position */}
          {colors.map((color, index) => (
            <TableRow
              key={color.slug}
              data-testid="color-row"
              data-slug={color.slug}
              data-active={String(color.active)}
            >
              <OrdinalCell n={index + 1} />
              <TableCell>
                <span className="inline-flex items-center gap-2">
                  {/* the one legitimate inline colour: it is product data */}
                  <span
                    aria-hidden
                    className="inline-block size-4 shrink-0 rounded-full border"
                    style={{ background: color.hex }}
                  />
                  <span className="font-medium">{color.name}</span>
                  {color.dark ? (
                    <Badge variant="outline" className="text-muted-foreground">
                      {t("dark")}
                    </Badge>
                  ) : null}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground font-mono text-xs">{color.slug}</TableCell>
              <TableCell className="text-muted-foreground font-mono text-xs">{color.hex}</TableCell>
              <TableCell className="text-right tabular-nums">{count(color.productCount)}</TableCell>
              <TableCell className="text-muted-foreground text-right tabular-nums">
                {count(color.orderItemCount)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={color.active}
                    disabled={!canEdit || (toggle.isPending && toggle.variables?.slug === color.slug)}
                    onCheckedChange={(active) => toggle.mutate({ slug: color.slug, active })}
                    aria-label={t("offerAria", { name: color.name })}
                    data-testid="color-active"
                  />
                  <StatusBadge status={color.active ? "ACTIVE" : "INACTIVE"} />
                </div>
              </TableCell>
              <TableCell>{canEdit ? <ColorDialog mode="edit" color={color} /> : null}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}
