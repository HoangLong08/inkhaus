"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import NumberInput from "@/components/catalog/NumberInput";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { CatalogSize } from "@/lib/api";
import { ClientApiError, clientApi } from "@/lib/client-api";
import { useTranslatedResolver } from "@/lib/form-resolver";
import { queryKeys } from "@/lib/query-keys";
import {
  CATALOG_VALIDATION_PARAMS,
  sizeInputSchema,
  type SizeInput,
  type SizeUpdateInput,
} from "@/lib/schemas/forms";

type Props = {
  /** may set an upcharge at all - `catalog.price` */
  canPrice: boolean;
  priceEditsEnabled: boolean;
} & ({ mode: "create" } | { mode: "edit"; size: CatalogSize });

/**
 * New size code, or edit one. The upcharge is money: owners only, and locked
 * while price edits are off - and then left out of the PATCH body, so a label
 * change is never refused for a price nobody touched.
 */
export default function SizeDialog(props: Props) {
  const t = useTranslations("Sizes");
  const [open, setOpen] = useState(false);
  const size = props.mode === "edit" ? props.size : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {size ? (
          <Button variant="ghost" size="icon-sm" data-testid="size-edit" aria-label={t("dialog.edit", { code: size.code })}>
            <Pencil />
          </Button>
        ) : (
          <Button size="sm" data-testid="size-new">
            <Plus />
            {t("dialog.new")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{size ? t("dialog.edit", { code: size.code }) : t("dialog.new")}</DialogTitle>
          <DialogDescription>
            {t("dialog.description")}
          </DialogDescription>
        </DialogHeader>
        <SizeForm
          size={size}
          upchargeLocked={!props.canPrice || !props.priceEditsEnabled}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

const BLANK: SizeInput = { code: "", label: "", upcharge: 0, sortOrder: 100 };

function SizeForm({
  size,
  upchargeLocked,
  onDone,
}: {
  size?: CatalogSize;
  upchargeLocked: boolean;
  onDone: () => void;
}) {
  const t = useTranslations("Sizes");
  const tc = useTranslations("Common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = queryKeys.catalog.sizes();
  const saved: SizeInput = size
    ? { code: size.code, label: size.label, upcharge: size.upcharge, sortOrder: size.sortOrder }
    : BLANK;

  const form = useForm<SizeInput>({
    resolver: useTranslatedResolver<SizeInput>(sizeInputSchema, CATALOG_VALIDATION_PARAMS),
    defaultValues: saved,
  });

  const mutation = useMutation({
    mutationFn: (values: SizeInput) =>
      size
        ? clientApi.catalog.updateSize(size.code, sizeChanges(values, saved, upchargeLocked))
        : clientApi.catalog.createSize(values),

    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CatalogSize[]>(key);
      queryClient.setQueryData<CatalogSize[]>(key, (list = []) =>
        size
          ? list.map((s) =>
              s.code === size.code
                ? { ...s, ...sizeChanges(values, saved, upchargeLocked) }
                : s,
            )
          : [...list, { ...values, productCount: 0, builtIn: false }],
      );
      return { previous };
    },

    onError: (error, _values, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      if (error instanceof ClientApiError && error.status === 401) return;
      toast.error(size ? t("form.saveError") : t("form.addError"), {
        description: error.message,
      });
    },

    onSuccess: (next) => {
      queryClient.setQueryData<CatalogSize[]>(key, (list = []) =>
        list.map((s) => (s.code === next.code ? next : s)),
      );
      toast.success(
        size ? t("form.saved", { code: next.code }) : t("form.added", { code: next.code }),
      );
      onDone();
    },

    onSettled: () => {
      // the product form's size picker reads the same list
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all() });
      router.refresh();
    },
  });

  function submit(values: SizeInput) {
    if (size && Object.keys(sizeChanges(values, saved, upchargeLocked)).length === 0) {
      onDone();
      return;
    }
    mutation.mutate(values);
  }

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(submit)} className="space-y-4">
        {size ? null : (
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("form.code")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("form.codePlaceholder")}
                    autoComplete="off"
                    className="font-mono uppercase"
                    maxLength={6}
                    data-testid="size-code"
                    {...field}
                    onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                  />
                </FormControl>
                <FormDescription>{t("form.codeHint")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.label")}</FormLabel>
              <FormControl>
                <Input
                  maxLength={20}
                  placeholder={t("form.codePlaceholder")}
                  data-testid="size-label"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="upcharge"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.upcharge")}</FormLabel>
              <FormControl>
                <NumberInput
                  {...field}
                  step={0.01}
                  inputMode="decimal"
                  className="tabular-nums"
                  disabled={upchargeLocked}
                  data-testid="size-upcharge"
                />
              </FormControl>
              {upchargeLocked ? (
                <FormDescription>{t("form.upchargeHint")}</FormDescription>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sortOrder"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.sortOrder")}</FormLabel>
              <FormControl>
                <NumberInput {...field} step={1} inputMode="numeric" className="tabular-nums" data-testid="size-sort-order" />
              </FormControl>
              <FormDescription>Size pickers list sizes in this order.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" data-testid="size-cancel">
              {tc("cancel")}
            </Button>
          </DialogClose>
          <Button type="submit" disabled={mutation.isPending} data-testid="size-save">
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {size ? t("form.save") : t("form.add")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

/** only what changed; the upcharge never leaves a form where it is locked */
function sizeChanges(values: SizeInput, saved: SizeInput, upchargeLocked: boolean): SizeUpdateInput {
  const patch: SizeUpdateInput = {};
  if (values.label !== saved.label) patch.label = values.label;
  if (!upchargeLocked && values.upcharge !== saved.upcharge) patch.upcharge = values.upcharge;
  if (values.sortOrder !== saved.sortOrder) patch.sortOrder = values.sortOrder;
  return patch;
}
