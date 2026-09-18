"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { can } from "@inkhaus/shared/admin";
import type { AdminRoleCode } from "@inkhaus/shared/orders";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  GARMENT_TYPE_LABEL,
  GARMENT_TYPES,
  PRINT_METHODS,
} from "@inkhaus/shared/taxonomy";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import NumberInput from "@/components/catalog/NumberInput";
import PriceSyncWarning from "@/components/catalog/PriceSyncWarning";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCodeLabel } from "@/i18n/labels";
import type { CatalogColor, CatalogProduct, CatalogSize } from "@/lib/api";
import { ClientApiError, clientApi } from "@/lib/client-api";
import { usd } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import {
  PRODUCT_PRICE_FIELDS,
  productInputSchema,
  type ProductInput,
  type ProductUpdateInput,
} from "@/lib/schemas/forms";

type Shared = {
  role: AdminRoleCode;
  priceEditsEnabled: boolean;
  /** every size code, in the sizes table's order */
  sizes: CatalogSize[];
  /** every colour, archived included - one already on the product may stay on it */
  colors: CatalogColor[];
};

type Props = Shared & ({ mode: "create" } | { mode: "edit"; slug: string });

/**
 * The one form a blank is created and edited through. Prices are a field-level
 * rule (D12, D13): staff see them read-only, and an owner sees them locked
 * while price edits are off. Either way the price keys are left out of the
 * PATCH body entirely - a save of the blurb must not be refused for a price
 * nobody touched. The route handler and the API check the same rule again.
 */
export default function ProductForm(props: Props) {
  return props.mode === "create" ? <CreateProduct {...props} /> : <EditProduct {...props} />;
}

/** a new blank starts archived, so the storefront does not list it before it is ready */
const NEW_PRODUCT: ProductInput = {
  slug: "",
  name: "",
  type: "tee",
  category: "apparel",
  blurb: "",
  fabric: "",
  tag: "",
  sizes: [],
  // blank on purpose: a price is a decision, not a default
  price: Number.NaN,
  bulkPrice: Number.NaN,
  methods: ["DTG"],
  // a tee's front, which is what most new blanks are
  printArea: { x: 204, y: 242, w: 192, h: 256 },
  printInches: { w: 12, h: 16 },
  colorSlugs: [],
  active: false,
  sortOrder: 100,
};

function CreateProduct({ role, priceEditsEnabled, sizes, colors }: Shared) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<ProductInput>({
    resolver: zodResolver(productInputSchema),
    defaultValues: NEW_PRODUCT,
  });

  const mutation = useMutation({
    mutationFn: (input: ProductInput) => clientApi.catalog.createProduct(input),
    // No onMutate: there is no cache entry to write optimistically until the
    // server has accepted the slug.
    onError: (error) => {
      if (error instanceof ClientApiError && error.status === 401) return;
      toast.error("Could not create the product", { description: error.message });
    },
    onSuccess: (product) => {
      queryClient.setQueryData(queryKeys.catalog.product(product.slug), product);
      toast.success(`Created ${product.name}`);
      router.push(`/catalog/products/${product.slug}`);
    },
    onSettled: () => {
      // colour and size product counts include the new blank
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all() });
    },
  });

  return (
    <ProductFields
      form={form}
      mode="create"
      canPrice={can(role, "catalog.price")}
      priceEditsEnabled={priceEditsEnabled}
      sizes={sizes}
      colors={colors}
      linked={new Set()}
      pending={mutation.isPending}
      onSubmit={(values) => mutation.mutate(values)}
    />
  );
}

function EditProduct({ slug, ...shared }: Shared & { slug: string }) {
  const { data: product } = useQuery({
    queryKey: queryKeys.catalog.product(slug),
    queryFn: () => clientApi.catalog.product(slug),
    // an open form must not be swapped out from under whoever is typing in it
    refetchOnWindowFocus: false,
  });

  // Hydrated by the page, so this is not a state that occurs.
  if (!product) return null;

  // Keyed on the saved version: a successful save remounts the form with what
  // the server stored, which is also what clears its dirty state. An optimistic
  // write or a rollback keeps `updatedAt`, so neither throws away what was typed.
  return <ProductEditor key={product.updatedAt} product={product} {...shared} />;
}

function ProductEditor({ product, role, priceEditsEnabled, sizes, colors }: Shared & { product: CatalogProduct }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = queryKeys.catalog.product(product.slug);
  const canPrice = can(role, "catalog.price");
  const priceLocked = !canPrice || !priceEditsEnabled;
  const saved = toFormValues(product);

  const form = useForm<ProductInput>({
    resolver: zodResolver(productInputSchema),
    defaultValues: saved,
  });

  const mutation = useMutation({
    mutationFn: (patch: ProductUpdateInput) => clientApi.catalog.updateProduct(product.slug, patch),

    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CatalogProduct>(key);
      queryClient.setQueryData<CatalogProduct>(key, (current) =>
        current ? withPatch(current, patch, colors) : current,
      );
      return { previous };
    },

    onError: (error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      // 401 already redirected inside clientApi
      if (error instanceof ClientApiError && error.status === 401) return;
      toast.error("Could not save the product", { description: error.message });
    },

    onSuccess: (next) => {
      queryClient.setQueryData(key, next);
      toast.success(`Saved ${next.name}`);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all() });
      // the heading, the status badge and the history card are server rendered
      router.refresh();
    },
  });

  function submit(values: ProductInput) {
    const patch = productChanges(values, saved, priceLocked);
    if (!patch) {
      toast.info("Nothing to save - no field has changed.");
      return;
    }
    mutation.mutate(patch);
  }

  return (
    <ProductFields
      form={form}
      mode="edit"
      canPrice={canPrice}
      priceEditsEnabled={priceEditsEnabled}
      sizes={sizes}
      colors={colors}
      linked={new Set(product.colors.map((c) => c.slug))}
      pending={mutation.isPending}
      onSubmit={submit}
    />
  );
}

/* ----------------------------------------------------------------- fields */

type FieldsProps = {
  form: UseFormReturn<ProductInput>;
  mode: "create" | "edit";
  canPrice: boolean;
  priceEditsEnabled: boolean;
  sizes: CatalogSize[];
  colors: CatalogColor[];
  /** colours already on the product - an archived one may stay (D11) */
  linked: ReadonlySet<string>;
  pending: boolean;
  onSubmit: (values: ProductInput) => void;
};

function ProductFields({
  form,
  mode,
  canPrice,
  priceEditsEnabled,
  sizes,
  colors,
  linked,
  pending,
  onSubmit,
}: FieldsProps) {
  const priceLocked = !canPrice || !priceEditsEnabled;
  const sizeCodes = sizes.map((s) => s.code);
  const methodLabel = useCodeLabel("PrintMethod");

  return (
    <Form {...form}>
      {/* noValidate: zod owns every message; the browser's own bubbles would
          fire first on a type=number step mismatch and say something else */}
      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      >
        <div className="space-y-6">
          <Section title="Details">
            {mode === "create" ? (
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="heavyweight-tee"
                        autoComplete="off"
                        data-testid="product-slug"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The storefront URL and what saved carts point at. It cannot be changed later.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input maxLength={80} data-testid="product-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Blank shape</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full" data-testid="product-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GARMENT_TYPES.map((type) => (
                          <SelectItem
                            key={type}
                            value={type}
                            data-testid="product-type-option"
                            data-type={type}
                          >
                            {GARMENT_TYPE_LABEL[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Which outline the design studio draws.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full" data-testid="product-category">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem
                            key={category}
                            value={category}
                            data-testid="product-category-option"
                            data-category={category}
                          >
                            {CATEGORY_LABEL[category]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>The storefront aisle it is shelved in.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="tag"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Tag <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input maxLength={24} placeholder="Bestseller" data-testid="product-tag" {...field} />
                  </FormControl>
                  <FormDescription>A short badge on the product card. Leave empty for none.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="blurb"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Blurb</FormLabel>
                  <FormControl>
                    <Textarea rows={3} maxLength={400} data-testid="product-blurb" {...field} />
                  </FormControl>
                  <FormDescription className="tabular-nums">{field.value.length}/400</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fabric"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fabric</FormLabel>
                  <FormControl>
                    <Input maxLength={200} data-testid="product-fabric" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Section>

          <Section title="Print methods">
            <CheckboxGroup
              form={form}
              name="methods"
              label="Offered in"
              testId="product-method"
              dataName="data-method"
              // the shared PRINT_METHOD_LABEL table is a wire value, not display
              // copy (AGENTS.md s9) - the translated one is keyed off the code
              options={PRINT_METHODS.map((m) => ({ value: m, label: methodLabel(m) }))}
              order={(values) => PRINT_METHODS.filter((m) => values.includes(m))}
            />
          </Section>

          <Section title="Sizes">
            <CheckboxGroup
              form={form}
              name="sizes"
              label="Size run"
              description="Leave every box empty for the default apparel run (XS to 3XL). Non-apparel carries OS only."
              testId="product-size"
              dataName="data-size"
              options={sizes.map((s) => ({
                value: s.code,
                label: (
                  <span className="inline-flex items-baseline gap-1.5">
                    <span className="font-mono">{s.code}</span>
                    {s.label !== s.code ? (
                      <span className="text-muted-foreground">{s.label}</span>
                    ) : null}
                    {s.upcharge > 0 ? (
                      <span className="text-muted-foreground text-xs">+{usd(s.upcharge)}</span>
                    ) : null}
                  </span>
                ),
              }))}
              order={(values) => sizeCodes.filter((code) => values.includes(code))}
            />
          </Section>

          <Section title="Colours">
            <CheckboxGroup
              form={form}
              name="colorSlugs"
              label="Colourways"
              description="The first one checked is the storefront's default. Archived colours cannot be added, but may stay where they already are."
              testId="product-color"
              dataName="data-color"
              options={colors
                .filter((c) => c.active || linked.has(c.slug))
                .map((c) => ({
                  value: c.slug,
                  label: (
                    <span className="inline-flex items-center gap-2">
                      {/* the one legitimate inline colour: it is product data */}
                      <span
                        aria-hidden
                        className="inline-block size-4 shrink-0 rounded-full border"
                        style={{ background: c.hex }}
                      />
                      {c.name}
                      {!c.active ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          Archived
                        </Badge>
                      ) : null}
                    </span>
                  ),
                }))}
              // a newly checked colour goes last, so saving never reorders the
              // colourways a product already shows
              order={(values) => values}
            />
          </Section>

          <Section
            title="Print area"
            description="Where artwork may go, in the blank outline's own units, and how big that is on the garment."
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <NumberField form={form} name="printArea.x" label="Left" testId="product-print-x" />
              <NumberField form={form} name="printArea.y" label="Top" testId="product-print-y" />
              <NumberField form={form} name="printArea.w" label="Width" testId="product-print-w" />
              <NumberField form={form} name="printArea.h" label="Height" testId="product-print-h" />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <NumberField
                form={form}
                name="printInches.w"
                label="Width (in)"
                step={0.01}
                testId="product-inches-w"
              />
              <NumberField
                form={form}
                name="printInches.h"
                label="Height (in)"
                step={0.01}
                testId="product-inches-h"
              />
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section
            title="Pricing"
            description={
              !canPrice
                ? "Owners set prices."
                : "The single-unit price, and the 50+ floor no volume discount goes below."
            }
          >
            {!priceEditsEnabled ? <PriceSyncWarning /> : null}
            <NumberField
              form={form}
              name="price"
              label="Price, one unit"
              step={0.01}
              disabled={priceLocked}
              testId="product-price"
            />
            <NumberField
              form={form}
              name="bulkPrice"
              label="Bulk price (floor)"
              step={0.01}
              disabled={priceLocked}
              testId="product-bulk-price"
            />
          </Section>

          <Section title="Visibility">
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-4">
                    <FormLabel>On sale</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="product-active"
                      />
                    </FormControl>
                  </div>
                  <FormDescription>
                    Archiving stops checkout for this blank at once - but the storefront keeps
                    listing it until it reads the catalog from the API.
                  </FormDescription>
                </FormItem>
              )}
            />
            <NumberField
              form={form}
              name="sortOrder"
              label="Sort order"
              description="Lower comes first on the storefront and in this list."
              testId="product-sort-order"
            />
          </Section>

          <Button type="submit" className="w-full" disabled={pending} data-testid="product-save">
            {pending ? <Loader2 className="animate-spin" /> : null}
            {mode === "create" ? "Create product" : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

type NumberPath =
  | "price"
  | "bulkPrice"
  | "sortOrder"
  | "printArea.x"
  | "printArea.y"
  | "printArea.w"
  | "printArea.h"
  | "printInches.w"
  | "printInches.h";

function NumberField({
  form,
  name,
  label,
  testId,
  step = 1,
  disabled,
  description,
}: {
  form: UseFormReturn<ProductInput>;
  name: NumberPath;
  label: string;
  testId: string;
  step?: number;
  disabled?: boolean;
  description?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <NumberInput
              {...field}
              step={step}
              inputMode={step < 1 ? "decimal" : "numeric"}
              className="tabular-nums"
              // on the input only, never on the field: a disabled RHF field
              // submits undefined, and the diff below decides what is sent
              disabled={disabled}
              data-testid={testId}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * A set of checkboxes over one array field - shadcn's own pattern, a FormField
 * per option. The value rides on `dataName` (`data-method`, `data-size`,
 * `data-color`) so a test never has to read a label.
 */
function CheckboxGroup({
  form,
  name,
  label,
  description,
  options,
  testId,
  dataName,
  order,
}: {
  form: UseFormReturn<ProductInput>;
  name: "methods" | "sizes" | "colorSlugs";
  label: string;
  description?: string;
  options: { value: string; label: React.ReactNode }[];
  testId: string;
  dataName: string;
  /** where a freshly checked value belongs in the saved array */
  order: (values: string[]) => string[];
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ fieldState }) => (
        <FormItem>
          {/* A FormLabel here would point at an input that does not exist: a
              set of checkboxes is a group, named by its legend, and each box
              keeps its own label. */}
          <fieldset className="min-w-0 space-y-2">
            <legend
              data-error={!!fieldState.error}
              className="data-[error=true]:text-destructive mb-2 text-sm leading-none font-medium"
            >
              {label}
            </legend>
            {description ? <FormDescription>{description}</FormDescription> : null}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {options.map((option) => (
                <FormField
                  key={option.value}
                  control={form.control}
                  name={name}
                  render={({ field }) => {
                    const values = field.value as string[];
                    return (
                      <FormItem className="flex flex-row items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={values.includes(option.value)}
                            onCheckedChange={(checked) =>
                              field.onChange(
                                checked === true
                                  ? order([...values, option.value])
                                  : values.filter((v) => v !== option.value),
                              )
                            }
                            data-testid={testId}
                            // a computed data-* name cannot be written as a JSX attribute
                            {...({ [dataName]: option.value } as object)}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">{option.label}</FormLabel>
                      </FormItem>
                    );
                  }}
                />
              ))}
            </div>
          </fieldset>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/* ---------------------------------------------------------------- helpers */

/** every key a PATCH may carry - all of ProductInput but the slug */
const EDITABLE_KEYS = [
  "name",
  "type",
  "category",
  "blurb",
  "fabric",
  "tag",
  "sizes",
  "price",
  "bulkPrice",
  "methods",
  "printArea",
  "printInches",
  "colorSlugs",
  "active",
  "sortOrder",
] as const satisfies readonly (keyof ProductUpdateInput)[];

function toFormValues(p: CatalogProduct): ProductInput {
  return {
    slug: p.slug,
    name: p.name,
    type: p.type,
    category: p.category,
    blurb: p.blurb,
    fabric: p.fabric,
    tag: p.tag ?? "",
    sizes: p.sizes,
    price: p.price,
    bulkPrice: p.bulkPrice,
    methods: p.methods,
    printArea: { x: p.printArea.x, y: p.printArea.y, w: p.printArea.w, h: p.printArea.h },
    printInches: { w: p.printInches.w, h: p.printInches.h },
    colorSlugs: p.colors.map((c) => c.slug),
    active: p.active,
    sortOrder: p.sortOrder,
  };
}

/**
 * Only what changed, so the audit trail records real edits and a stale tab
 * cannot write back fields it never touched. Price keys never leave a form
 * whose prices are locked - a staff body carries none at all.
 */
function productChanges(
  values: ProductInput,
  saved: ProductInput,
  priceLocked: boolean,
): ProductUpdateInput | null {
  const locked: readonly string[] = priceLocked ? PRODUCT_PRICE_FIELDS : [];
  const changed = EDITABLE_KEYS.filter(
    (key) => !locked.includes(key) && JSON.stringify(values[key]) !== JSON.stringify(saved[key]),
  );
  if (changed.length === 0) return null;
  return Object.fromEntries(changed.map((key) => [key, values[key]])) as ProductUpdateInput;
}

/** the cached product as the server will store it, for the optimistic write */
function withPatch(
  product: CatalogProduct,
  patch: ProductUpdateInput,
  colors: CatalogColor[],
): CatalogProduct {
  const { colorSlugs, tag, ...fields } = patch;
  const next: CatalogProduct = {
    ...product,
    ...(Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    ) as Partial<CatalogProduct>),
  };
  if (tag !== undefined) next.tag = tag || null;
  if (colorSlugs) {
    next.colors = colorSlugs.flatMap((slug) => {
      const color = colors.find((c) => c.slug === slug);
      return color
        ? [{ slug, name: color.name, hex: color.hex, dark: color.dark, active: color.active }]
        : [];
    });
  }
  return next;
}
