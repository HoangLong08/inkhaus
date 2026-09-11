"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { can } from "@inkhaus/shared/admin";
import { canConvertQuote, type AdminRoleCode } from "@inkhaus/shared/orders";
import { quote as priceQuote, SIZE_LABEL } from "@inkhaus/shared/pricing";
import { PRINT_METHOD_LABEL, type PrintMethodCode } from "@inkhaus/shared/taxonomy";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, FileOutput, Loader2, PackageCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AdminQuoteDetail, CatalogOptions } from "@/lib/api";
import { ClientApiError, clientApi } from "@/lib/client-api";
import { count, humanize, pct, usd } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import {
  CONVERT_NOTES_MAX,
  quoteConvertInputSchema,
  type QuoteConvertFormValues,
  type QuoteConvertInput,
} from "@/lib/schemas/forms";

import { useQuoteDetail } from "./useQuoteDetail";

type Props = {
  id: string;
  role: AdminRoleCode;
  /**
   * What the form is built from - `adminApi.lookups.catalogOptions`, prices
   * included - read on the server. Null when this viewer may not convert -
   * then there is no form to build.
   */
  options: CatalogOptions | null;
  /** the quote's own product and method, offered as the starting point */
  suggested: { productSlug: string | null; method: string | null };
};

/**
 * Where a won lead becomes an order. Once it has, the same spot links to that
 * order instead, and the dialog is gone for good - the quote is WON and linked,
 * and the API would refuse a second conversion anyway.
 *
 * Shown only when both halves of the rule agree: this role may convert
 * (`quotes.convert`), and this quote may be converted (`canConvertQuote` - not
 * already an order, not LOST). The route handler and the API check both again.
 */
export default function ConvertQuoteDialog({ id, role, options, suggested }: Props) {
  const { data: quote } = useQuoteDetail(id);

  if (!quote) return null;

  if (quote.convertedOrderNumber) {
    return (
      <Button asChild variant="outline" className="w-full">
        <Link
          href={`/orders/${encodeURIComponent(quote.convertedOrderNumber)}`}
          data-testid="quote-order-link"
          data-number={quote.convertedOrderNumber}
        >
          <PackageCheck />
          Order {quote.convertedOrderNumber}
        </Link>
      </Button>
    );
  }

  if (
    !options ||
    !can(role, "quotes.convert") ||
    !canConvertQuote({ status: quote.status, convertedOrderId: quote.convertedOrderNumber })
  ) {
    return null;
  }

  return <ConvertForm id={id} quoted={quote.estimated} options={options} suggested={suggested} />;
}

function ConvertForm({
  id,
  quoted,
  options: catalog,
  suggested,
}: {
  id: string;
  quoted: number | null;
  options: CatalogOptions;
  suggested: Props["suggested"];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // every active product, each with the list and bulk price the estimate needs
  const products = catalog.products;

  const start = products.find((p) => p.slug === suggested.productSlug);

  const form = useForm<QuoteConvertFormValues, unknown, QuoteConvertInput>({
    resolver: zodResolver(quoteConvertInputSchema),
    defaultValues: {
      productSlug: start?.slug ?? "",
      colorSlug: "",
      method:
        start && suggested.method && start.methods.includes(suggested.method) ? suggested.method : "",
      sizes: (start?.sizes ?? []).map((size) => ({ size, qty: 0 })),
      notes: "",
    },
  });
  const { fields, replace } = useFieldArray({ control: form.control, name: "sizes" });
  const [productSlug, sizes] = useWatch({ control: form.control, name: ["productSlug", "sizes"] });

  const product = products.find((p) => p.slug === productSlug);

  // The same `quote()` the API prices the order with, against the ladder the
  // API read a moment ago. An estimate, not a promise: the order is priced
  // again, from the database, when it is created.
  const lines = (sizes ?? []).filter((line) => Number.isInteger(line.qty) && line.qty > 0);
  const estimate = product && lines.length > 0 ? priceQuote(product, lines, catalog.ladder) : null;

  const sizesError =
    form.formState.errors.sizes?.root?.message ?? form.formState.errors.sizes?.message;

  /**
   * A different product has its own colours, methods and size run. What still
   * fits is kept - quantities for the sizes both runs share, the colour and
   * method if the new product has them - and the rest is cleared rather than
   * left to fail on submit.
   */
  function chooseProduct(slug: string) {
    setPickerOpen(false);
    const next = products.find((p) => p.slug === slug);
    if (!next || slug === form.getValues("productSlug")) return;

    form.setValue("productSlug", slug, { shouldValidate: form.formState.isSubmitted });
    if (!next.colors.some((c) => c.slug === form.getValues("colorSlug"))) {
      form.setValue("colorSlug", "");
    }
    if (!next.methods.includes(form.getValues("method"))) form.setValue("method", "");

    const kept = new Map(form.getValues("sizes").map((line) => [line.size, line.qty]));
    replace(next.sizes.map((size) => ({ size, qty: kept.get(size) ?? 0 })));
  }

  const key = queryKeys.quotes.detail(id);
  const mutation = useMutation({
    mutationFn: (input: QuoteConvertInput) => clientApi.quotes.convert(id, input),

    // The badge reads WON while the order is being made; the link to it can
    // only appear once the server has given it a number.
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AdminQuoteDetail>(key);
      if (previous) queryClient.setQueryData<AdminQuoteDetail>(key, { ...previous, status: "WON" });
      return { previous };
    },

    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      if (error instanceof ClientApiError && error.status === 401) return;
      toast.error("Could not convert the quote", { description: error.message });
    },

    onSuccess: ({ order, quote }) => {
      queryClient.setQueryData(key, quote);
      toast.success(`Draft order ${order.number} created`);
      setOpen(false);
      router.push(`/orders/${encodeURIComponent(order.number)}`);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.quotes.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all() });
    },
  });

  return (
    <Dialog
      open={open}
      // not while the order is being created: closing would hide the outcome
      onOpenChange={(next) => (mutation.isPending ? undefined : setOpen(next))}
    >
      <DialogTrigger asChild>
        <Button className="w-full" data-testid="quote-convert-open">
          <FileOutput />
          Convert to order
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" data-testid="quote-convert-dialog">
        <DialogHeader>
          <DialogTitle>Convert to an order</DialogTitle>
          <DialogDescription>
            Creates a draft order priced from today&apos;s catalog, and marks this quote won. It
            can only be done once.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit((input) => mutation.mutate(input))}
          >
            <FormField
              control={form.control}
              name="productSlug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  {/* modal: a list inside a modal dialog only scrolls if the
                      popover takes over scroll-locking from it */}
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen} modal>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={pickerOpen}
                          className="w-full justify-between font-normal"
                          data-testid="convert-product"
                          data-slug={field.value}
                        >
                          {product ? (
                            product.name
                          ) : (
                            <span className="text-muted-foreground">Pick a product</span>
                          )}
                          <ChevronsUpDown className="text-muted-foreground" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
                      <Command>
                        <CommandInput placeholder="Search products…" />
                        <CommandList>
                          <CommandEmpty>No product matches.</CommandEmpty>
                          <CommandGroup>
                            {products.map((p) => (
                              <CommandItem
                                key={p.slug}
                                value={p.slug}
                                keywords={[p.name]}
                                onSelect={() => chooseProduct(p.slug)}
                                data-testid="convert-product-option"
                                data-slug={p.slug}
                              >
                                {p.name}
                                <Check
                                  className={cn(
                                    "ml-auto",
                                    p.slug === field.value ? "opacity-100" : "opacity-0",
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="colorSlug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Colour</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={!product}>
                      <FormControl>
                        <SelectTrigger
                          className="w-full"
                          data-testid="convert-color"
                          data-slug={field.value}
                        >
                          <SelectValue
                            placeholder={product ? "Pick a colour" : "Pick a product first"}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {product?.colors.map((color) => (
                          <SelectItem
                            key={color.slug}
                            value={color.slug}
                            data-testid="convert-color-option"
                            data-slug={color.slug}
                          >
                            {/* product data, like the swatch on the order page -
                                not a design token */}
                            <span
                              aria-hidden
                              className="inline-block size-3 rounded-full border"
                              style={{ background: color.hex }}
                            />
                            {color.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Print method</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={!product}>
                      <FormControl>
                        <SelectTrigger
                          className="w-full"
                          data-testid="convert-method"
                          data-method={field.value}
                        >
                          <SelectValue
                            placeholder={product ? "Pick a method" : "Pick a product first"}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {product?.methods.map((method) => (
                          <SelectItem
                            key={method}
                            value={method}
                            data-testid="convert-method-option"
                            data-method={method}
                          >
                            {PRINT_METHOD_LABEL[method as PrintMethodCode] ?? humanize(method)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Quantities</legend>
              {fields.length === 0 ? (
                <p className="text-muted-foreground text-sm">Pick a product to see its sizes.</p>
              ) : (
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
                  {fields.map((line, index) => {
                    const upcharge = catalog.ladder.upcharges[line.size] ?? 0;
                    return (
                      <FormField
                        key={line.id}
                        control={form.control}
                        name={`sizes.${index}.qty`}
                        render={({ field }) => (
                          <FormItem className="gap-1">
                            <FormLabel className="text-xs">{SIZE_LABEL[line.size] ?? line.size}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                step={1}
                                placeholder="0"
                                className="tabular-nums"
                                data-testid="convert-size-qty"
                                data-size={line.size}
                                name={field.name}
                                ref={field.ref}
                                onBlur={field.onBlur}
                                // 0 shows as the placeholder, so an untouched
                                // size reads as empty rather than as a choice
                                value={field.value || ""}
                                onChange={(event) =>
                                  field.onChange(
                                    event.target.value === "" ? 0 : event.target.valueAsNumber,
                                  )
                                }
                              />
                            </FormControl>
                            {upcharge > 0 ? (
                              <FormDescription className="text-xs">+{usd(upcharge)}</FormDescription>
                            ) : null}
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    );
                  })}
                </div>
              )}
              {sizesError ? (
                <p role="alert" className="text-destructive text-sm">
                  {sizesError}
                </p>
              ) : null}
            </fieldset>

            <div className="space-y-1 text-sm" aria-live="polite">
              {estimate ? (
                <p
                  data-testid="convert-estimate"
                  data-total={estimate.subtotal}
                  data-units={estimate.quantity}
                >
                  <span className="font-semibold tabular-nums">{usd(estimate.subtotal)}</span> for{" "}
                  {count(estimate.quantity)} units · {usd(estimate.baseUnitPrice)} each
                  {estimate.tier.off > 0 ? ` (${pct(estimate.tier.off)} off)` : ""}
                </p>
              ) : (
                <p className="text-muted-foreground">Enter quantities to see an estimate.</p>
              )}
              <p className="text-muted-foreground text-xs">
                Before shipping and tax.
                {quoted !== null ? ` The lead was quoted ${usd(quoted)}.` : ""}
              </p>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Order notes <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      maxLength={CONVERT_NOTES_MAX}
                      data-testid="convert-notes"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={mutation.isPending}
                  data-testid="convert-cancel"
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={mutation.isPending} data-testid="convert-submit">
                {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Create draft order
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
