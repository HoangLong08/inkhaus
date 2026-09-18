"use client";

import { TIER_LIMITS, validateTiers } from "@inkhaus/shared/pricing";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import NumberInput from "@/components/catalog/NumberInput";
import TierPreview, { type TierSample } from "@/components/catalog/TierPreview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CatalogTiers } from "@/lib/api";
import { ClientApiError, clientApi } from "@/lib/client-api";
import { useTranslatedResolver } from "@/lib/form-resolver";
import { queryKeys } from "@/lib/query-keys";
import {
  CATALOG_VALIDATION_PARAMS,
  tiersFormSchema,
  tiersFromForm,
  tiersToForm,
  type TiersFormValues,
  type TiersInput,
} from "@/lib/schemas/forms";

/**
 * The owners' ladder editor. The ladder is saved whole - `validateTiers` is a
 * rule about the ladder, not about a tier - and the preview beside it prices a
 * real product on what is typed, before anything is saved.
 */
export default function TierEditor({
  priceEditsEnabled,
  products,
}: {
  priceEditsEnabled: boolean;
  products: TierSample[];
}) {
  const { data } = useQuery({
    queryKey: queryKeys.catalog.tiers(),
    queryFn: () => clientApi.catalog.tiers(),
    // an open editor must not be swapped out from under whoever is typing in it
    refetchOnWindowFocus: false,
  });

  // Hydrated by the page, so this is not a state that occurs.
  if (!data) return null;

  return <TierForm initial={data} priceEditsEnabled={priceEditsEnabled} products={products} />;
}

function TierForm({
  initial,
  priceEditsEnabled,
  products,
}: {
  initial: CatalogTiers;
  priceEditsEnabled: boolean;
  products: TierSample[];
}) {
  const t = useTranslations("Tiers");
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = queryKeys.catalog.tiers();

  const form = useForm<TiersFormValues>({
    resolver: useTranslatedResolver<TiersFormValues>(tiersFormSchema, CATALOG_VALIDATION_PARAMS),
    defaultValues: tiersToForm(initial),
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "tiers" });

  // Live, so the preview follows every keystroke. Priced only while the ladder
  // is valid: an unordered one would show numbers checkout never charges.
  const rows = useWatch({ control: form.control, name: "tiers" });
  const ladder = rows.map((row) => ({ min: row.minQty, off: row.percent / 100 }));
  const preview = validateTiers(ladder) === null ? ladder : null;

  const tierErrors = form.formState.errors.tiers;
  const ladderError = tierErrors?.root?.message ?? tierErrors?.message;

  const mutation = useMutation({
    mutationFn: (input: TiersInput) => clientApi.catalog.replaceTiers(input),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CatalogTiers>(key);
      queryClient.setQueryData<CatalogTiers>(key, input);
      return { previous };
    },

    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      if (error instanceof ClientApiError && error.status === 401) return;
      // the form keeps what was typed, so the ladder can be fixed and saved again
      toast.error(t("ladder.saveError"), { description: error.message });
    },

    onSuccess: (saved) => {
      queryClient.setQueryData(key, saved);
      form.reset(tiersToForm(saved));
      toast.success(t("ladder.saved"));
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      // the page's tier count is server rendered
      router.refresh();
    },
  });

  function addTier() {
    const last = rows.at(-1);
    append({
      // double the last tier: ladders grow geometrically, and it is one edit away either way
      minQty: Math.min(TIER_LIMITS.maxMin, Math.max(2, (last?.minQty ?? 1) * 2)),
      percent: last?.percent ?? 0,
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Form {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit((values) => mutation.mutate(tiersFromForm(values)))}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                {t("ladder.title")}
              </CardTitle>
              <CardDescription>
                {t("ladder.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* one switch for every input and button inside, while price edits are off */}
              <fieldset disabled={!priceEditsEnabled} className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("ladder.from")}</TableHead>
                      <TableHead>{t("ladder.discount")}</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">{t("ladder.remove")}</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => (
                      <TableRow
                        key={field.id}
                        data-testid="tier-row"
                        data-min={rows[index]?.minQty}
                      >
                        <TableCell className="align-top">
                          <FormField
                            control={form.control}
                            name={`tiers.${index}.minQty`}
                            render={({ field: input }) => (
                              <FormItem>
                                <FormLabel className="sr-only">{t("ladder.minAria", { n: index + 1 })}</FormLabel>
                                <FormControl>
                                  <NumberInput
                                    {...input}
                                    step={1}
                                    inputMode="numeric"
                                    className="tabular-nums"
                                    // the first tier is fixed at one unit
                                    disabled={index === 0}
                                    data-testid="tier-min"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <FormField
                            control={form.control}
                            name={`tiers.${index}.percent`}
                            render={({ field: input }) => (
                              <FormItem>
                                <FormLabel className="sr-only">{t("ladder.discountAria", { n: index + 1 })}</FormLabel>
                                <FormControl>
                                  <NumberInput
                                    {...input}
                                    step={0.1}
                                    inputMode="decimal"
                                    className="tabular-nums"
                                    // ...at no discount
                                    disabled={index === 0}
                                    data-testid="tier-off"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={index === 0}
                            onClick={() => remove(index)}
                            aria-label={t("ladder.removeAria", { n: index + 1 })}
                            data-testid="tier-remove"
                          >
                            <Trash2 />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={fields.length >= TIER_LIMITS.maxTiers}
                  onClick={addTier}
                  data-testid="tier-add"
                >
                  <Plus />
                  {t("ladder.add")}
                </Button>
              </fieldset>

              {ladderError ? (
                <Alert variant="destructive" data-testid="tiers-error">
                  <TriangleAlert />
                  <AlertTitle>{t("ladder.error")}</AlertTitle>
                  <AlertDescription>{ladderError}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
            <CardFooter className="justify-end">
              <Button
                type="submit"
                disabled={!priceEditsEnabled || mutation.isPending}
                data-testid="tiers-save"
              >
                {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
                {t("ladder.save")}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>

      <TierPreview tiers={preview} products={products} />
    </div>
  );
}
