"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import NumberInput from "@/components/catalog/NumberInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { CatalogColor } from "@/lib/api";
import { ClientApiError, clientApi } from "@/lib/client-api";
import { useTranslatedResolver } from "@/lib/form-resolver";
import { queryKeys } from "@/lib/query-keys";
import {
  CATALOG_VALIDATION_PARAMS,
  colorInputSchema,
  type ColorInput,
  type ColorUpdateInput,
} from "@/lib/schemas/forms";

type Props = { mode: "create" } | { mode: "edit"; color: CatalogColor };

/**
 * New colour, or edit one. The form lives inside DialogContent, which Radix
 * unmounts on close, so every opening starts from the colour as it is now.
 */
export default function ColorDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const color = props.mode === "edit" ? props.color : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {color ? (
          <Button variant="ghost" size="icon-sm" data-testid="color-edit" aria-label={`Edit ${color.name}`}>
            <Pencil />
          </Button>
        ) : (
          <Button size="sm" data-testid="color-new">
            <Plus />
            New colour
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{color ? `Edit ${color.name}` : "New colour"}</DialogTitle>
          <DialogDescription>
            {color
              ? "Renaming or recolouring shows everywhere this colour is offered. Past orders keep the colour they were made in."
              : "It can be added to products at once. Colours are archived, never deleted."}
          </DialogDescription>
        </DialogHeader>
        <ColorForm color={color} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

const BLANK: ColorInput = { slug: "", name: "", hex: "", dark: false, sortOrder: 0 };

function ColorForm({ color, onDone }: { color?: CatalogColor; onDone: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = queryKeys.catalog.colors();
  const saved: ColorInput = color
    ? { slug: color.slug, name: color.name, hex: color.hex, dark: color.dark, sortOrder: color.sortOrder }
    : BLANK;

  const form = useForm<ColorInput>({
    resolver: useTranslatedResolver<ColorInput>(colorInputSchema, CATALOG_VALIDATION_PARAMS),
    defaultValues: saved,
  });
  const hex = useWatch({ control: form.control, name: "hex" });

  const mutation = useMutation({
    mutationFn: (values: ColorInput) =>
      color
        ? clientApi.catalog.updateColor(color.slug, colorChanges(values, saved))
        : clientApi.catalog.createColor(values),

    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CatalogColor[]>(key);
      const row = { ...values, hex: values.hex.toUpperCase() };
      queryClient.setQueryData<CatalogColor[]>(key, (list = []) =>
        color
          ? list.map((c) => (c.slug === color.slug ? { ...c, ...row } : c))
          : [...list, { ...row, active: true, productCount: 0, orderItemCount: 0 }],
      );
      return { previous };
    },

    onError: (error, _values, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      if (error instanceof ClientApiError && error.status === 401) return;
      toast.error(color ? "Could not save the colour" : "Could not add the colour", {
        description: error.message,
      });
    },

    onSuccess: (next) => {
      queryClient.setQueryData<CatalogColor[]>(key, (list = []) =>
        list.map((c) => (c.slug === next.slug ? next : c)),
      );
      toast.success(color ? `Saved ${next.name}` : `Added ${next.name}`);
      onDone();
    },

    onSettled: () => {
      // product pages list colours too
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all() });
      router.refresh();
    },
  });

  function submit(values: ColorInput) {
    if (color && Object.keys(colorChanges(values, saved)).length === 0) {
      onDone();
      return;
    }
    mutation.mutate(values);
  }

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(submit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input maxLength={40} data-testid="color-name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {color ? null : (
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <Input placeholder="forest-green" autoComplete="off" data-testid="color-slug" {...field} />
                </FormControl>
                <FormDescription>Order lines and product photos point at it; it cannot change later.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="hex"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hex</FormLabel>
              <div className="flex items-center gap-2">
                {/* the one legitimate inline colour: it is product data */}
                <span
                  aria-hidden
                  className="inline-block size-9 shrink-0 rounded-md border"
                  style={{ background: /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : undefined }}
                />
                <FormControl>
                  <Input placeholder="#1A7F7A" className="font-mono" data-testid="color-hex" {...field} />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="dark"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-2">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} data-testid="color-dark" />
              </FormControl>
              <div className="space-y-1">
                <FormLabel className="font-normal">Dark garment</FormLabel>
                <FormDescription>Artwork printed on it needs light ink; the studio warns about dark-on-dark.</FormDescription>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sortOrder"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sort order</FormLabel>
              <FormControl>
                <NumberInput {...field} step={1} inputMode="numeric" className="tabular-nums" data-testid="color-sort-order" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" data-testid="color-cancel">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={mutation.isPending} data-testid="color-save">
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {color ? "Save" : "Add colour"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

/** only the fields that changed - the slug is the key, never a change */
function colorChanges(values: ColorInput, saved: ColorInput): ColorUpdateInput {
  const patch: ColorUpdateInput = {};
  if (values.name !== saved.name) patch.name = values.name;
  if (values.hex.toUpperCase() !== saved.hex.toUpperCase()) patch.hex = values.hex;
  if (values.dark !== saved.dark) patch.dark = values.dark;
  if (values.sortOrder !== saved.sortOrder) patch.sortOrder = values.sortOrder;
  return patch;
}
