"use client";

import { can } from "@inkhaus/shared/admin";
import type { AdminRoleCode } from "@inkhaus/shared/orders";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import SizeDialog from "@/components/catalog/SizeDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CatalogSize } from "@/lib/api";
import { ClientApiError, clientApi } from "@/lib/client-api";
import { count, usd } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

/**
 * Every size code. Staff may relabel and reorder; the upcharge, a new code
 * and deleting one are owners' (`catalog.price`). Delete is offered only for a
 * code nothing relies on - outside the default run and stocked by no product
 * (D11) - and the API refuses the rest with a 409 regardless.
 */
export default function SizesTable({
  role,
  priceEditsEnabled,
}: {
  role: AdminRoleCode;
  priceEditsEnabled: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = queryKeys.catalog.sizes();
  const canEdit = can(role, "catalog.edit");
  const canPrice = can(role, "catalog.price");

  const { data: sizes = [] } = useQuery({ queryKey: key, queryFn: () => clientApi.catalog.sizes() });

  const remove = useMutation({
    mutationFn: (code: string) => clientApi.catalog.deleteSize(code),

    onMutate: async (code) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CatalogSize[]>(key);
      queryClient.setQueryData<CatalogSize[]>(key, (list = []) => list.filter((s) => s.code !== code));
      return { previous };
    },

    onError: (error, _code, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      if (error instanceof ClientApiError && error.status === 401) return;
      toast.error("Could not delete the size", { description: error.message });
    },

    onSuccess: (_ok, code) => {
      // again, in case a refetch landed between the optimistic write and now
      queryClient.setQueryData<CatalogSize[]>(key, (list = []) => list.filter((s) => s.code !== code));
      toast.success(`Deleted ${code}`);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all() });
      router.refresh();
    },
  });

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Label</TableHead>
            <TableHead className="text-right">Upcharge</TableHead>
            <TableHead className="text-right">Sort</TableHead>
            <TableHead className="text-right">Products</TableHead>
            <TableHead className="w-24">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sizes.map((size) => {
            const deletable = canPrice && !size.builtIn && size.productCount === 0;
            return (
              <TableRow
                key={size.code}
                data-testid="size-row"
                data-code={size.code}
                data-built-in={String(size.builtIn)}
              >
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <span className="font-mono font-semibold">{size.code}</span>
                    {size.builtIn ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        Default run
                      </Badge>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell>{size.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {size.upcharge > 0 ? `+${usd(size.upcharge)}` : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-right tabular-nums">
                  {size.sortOrder}
                </TableCell>
                <TableCell className="text-right tabular-nums">{count(size.productCount)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {canEdit ? (
                      <SizeDialog
                        mode="edit"
                        size={size}
                        canPrice={canPrice}
                        priceEditsEnabled={priceEditsEnabled}
                      />
                    ) : null}
                    {deletable ? (
                      <DeleteSize code={size.code} onConfirm={(code) => remove.mutate(code)} />
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function DeleteSize({ code, onConfirm }: { code: string; onConfirm: (code: string) => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" data-testid="size-delete" aria-label={`Delete ${code}`}>
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete size {code}?</AlertDialogTitle>
          <AlertDialogDescription>
            No product stocks it, and past order lines keep their size as text, so nothing else
            changes. It can be added again later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="size-delete-cancel">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={() => onConfirm(code)}
            data-testid="size-delete-confirm"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
