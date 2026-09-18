import type { ReviewStatusCode } from "@inkhaus/shared/admin";
import type {
  AdminRoleCode,
  CarrierCode,
  OrderStatusCode,
  QuoteStatusCode,
} from "@inkhaus/shared/orders";
import type {
  GarmentType,
  PrintMethodCode,
  ProductCategory,
} from "@inkhaus/shared/taxonomy";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import { humanize } from "@/lib/format";

import type en from "../../messages/en.json";
import type vi from "../../messages/vi.json";

/**
 * What `humanize()` used to do, except translatable.
 *
 * `humanize("PENDING_PAYMENT")` returns "Pending payment" by de-snake-casing the
 * enum code, which is English by construction and cannot be translated at all.
 * Every one of its 23 call sites is really one of four vocabularies, so this is
 * a code -> label lookup per namespace rather than one status table.
 *
 * `humanize()` itself stays exactly where it is, in the frozen lib/format.ts, as
 * the fallback below. The API is a separate deployment on its own release
 * cadence (AGENTS.md s3.4); a status this build has never heard of has to render
 * as SOMETHING, and "Pending payment" beats a blank cell or a thrown error.
 *
 * The labels in @inkhaus/shared - CARRIER_LABEL, PRINT_METHOD_LABEL,
 * CATEGORY_LABEL - are deliberately NOT touched and stay English. They are not
 * display-only: apps/api round-trips PRINT_METHOD_LABEL as a wire value
 * (catalog.mapper.ts) and shared-contract.spec.ts pins the two together, so
 * translating them in place would silently change an API contract. This app
 * keys its own translations off the CODE, and i18n-check asserts that the `en`
 * catalogue still agrees with those tables.
 */

/* ------------------------------------------------------- the code tables */

/**
 * `GarmentType` and `Category` are the catalog's two vocabularies, and they are
 * deliberately NOT in CHROME_NAMESPACES: nineteen garment names and seven aisle
 * names on every navigation in the app, to serve two screens, is the cost s4
 * already refused to pay for `List`. A Server Component reads them straight off
 * the full catalogue; the one client component that needs them - ProductForm -
 * gets them from the provider its page nests.
 */
export const CODE_NAMESPACES = [
  "Status",
  "Role",
  "Carrier",
  "PrintMethod",
  "GarmentType",
  "Category",
] as const;

export type CodeNamespace = (typeof CODE_NAMESPACES)[number];

/**
 * Every code the `Status` table must carry. ACTIVE/INACTIVE are not an enum
 * anywhere - they are how this app spells the boolean `isActive` on staff,
 * colours, sizes and products - so they are written out.
 */
type StatusKey = OrderStatusCode | QuoteStatusCode | ReviewStatusCode | "ACTIVE" | "INACTIVE";

/* -------------------------------------------- exhaustive at compile time */

/**
 * The codes a catalogue is missing, as a union of their names.
 *
 * `NoneMissing` then constrains that union to `never`, so adding a status to
 * @inkhaus/shared without adding it to BOTH catalogues is a typecheck failure
 * whose message names the code: "Type '\"ON_HOLD\"' does not satisfy the
 * constraint 'never'". `npm run typecheck` is the gate; i18n-check repeats the
 * same assertion at runtime so a JSON-only edit cannot slip past a stale build.
 *
 * Extra keys are allowed on purpose - `Status` legitimately holds codes from
 * three different enums plus two literals.
 */
type Missing<Table, Codes extends string> = Exclude<Codes, keyof Table>;
type NoneMissing<T extends never> = T;

type En = typeof en;
type Vi = typeof vi;

export type _StatusEn = NoneMissing<Missing<En["Status"], StatusKey>>;
export type _StatusVi = NoneMissing<Missing<Vi["Status"], StatusKey>>;
export type _RoleEn = NoneMissing<Missing<En["Role"], AdminRoleCode>>;
export type _RoleVi = NoneMissing<Missing<Vi["Role"], AdminRoleCode>>;
export type _CarrierEn = NoneMissing<Missing<En["Carrier"], CarrierCode>>;
export type _CarrierVi = NoneMissing<Missing<Vi["Carrier"], CarrierCode>>;
export type _PrintMethodEn = NoneMissing<Missing<En["PrintMethod"], PrintMethodCode>>;
export type _PrintMethodVi = NoneMissing<Missing<Vi["PrintMethod"], PrintMethodCode>>;
export type _GarmentTypeEn = NoneMissing<Missing<En["GarmentType"], GarmentType>>;
export type _GarmentTypeVi = NoneMissing<Missing<Vi["GarmentType"], GarmentType>>;
export type _CategoryEn = NoneMissing<Missing<En["Category"], ProductCategory>>;
export type _CategoryVi = NoneMissing<Missing<Vi["Category"], ProductCategory>>;

/* --------------------------------------------------- the runtime lookups */

/**
 * The two calls this module makes on a translator, with the key widened to
 * `string`. The cast is deliberate and is confined to this file: a code arrives
 * from the API at runtime, so it is not a compile-time key, and `t.has()` exists
 * precisely to ask about a key you do not know. Exhaustiveness is enforced above
 * instead, where it can name the missing code.
 */
type CodeTranslator = {
  (key: string): string;
  has(key: string): boolean;
};

const lookup = (t: CodeTranslator) => (code: string) =>
  t.has(code) ? t(code) : humanize(code);

/**
 * Server Components AND Client Components. `useTranslations` is a hook, so the
 * one thing it cannot do is run in an `async` component - use `getCodeLabel`
 * there. That is what lets StatusBadge, which is rendered from both server
 * tables and client leaves, keep a single implementation.
 */
export function useCodeLabel(namespace: CodeNamespace) {
  return lookup(useTranslations(namespace) as unknown as CodeTranslator);
}

/** async Server Components, Route Handlers, generateMetadata */
export async function getCodeLabel(namespace: CodeNamespace) {
  return lookup((await getTranslations(namespace)) as unknown as CodeTranslator);
}

export const useStatusLabel = () => useCodeLabel("Status");
export const getStatusLabel = () => getCodeLabel("Status");

/**
 * Translate a FULLY QUALIFIED key that is only known at runtime - the `labelKey`
 * on a nav-config entry, which is a `string` rather than a literal because it is
 * data. The same cast as above, for the same reason, and kept in the same file
 * so there is exactly one place where a key stops being checked by the compiler.
 *
 * i18n-check assertion 6 is what checks these instead: it reads every `labelKey`
 * literal out of src/ and asserts it resolves in both catalogues.
 */
export function useKeyLabel() {
  const t = useTranslations() as unknown as CodeTranslator;
  return (key: string) => t(key);
}
