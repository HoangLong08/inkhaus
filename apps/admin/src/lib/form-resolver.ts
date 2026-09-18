"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import type { FieldErrors, FieldValues, Resolver, ResolverResult } from "react-hook-form";
import type { ZodType } from "zod";

/**
 * A `zodResolver` whose messages are keys, translated on the way out.
 *
 * A form schema in `src/lib/schemas/forms/` is evaluated at import time, in a
 * module a `"use client"` component and a route handler both load. Neither
 * `useTranslations` nor `getTranslations` can be called there, so a schema
 * cannot produce a translated sentence - and s6 already says what to do about
 * that: a failure travels as a CODE, never as a sentence, exactly as a sign-in
 * error travels as `?error=NOT_ALLOWED`.
 *
 * So the schema emits `"nameMax"` and this turns it into "Keep the name to 80
 * characters." `ui/form.tsx` is generated and renders `String(error.message)`
 * verbatim, so translating here rather than there means no fork of a shadcn
 * file - which s1 allows only with an `// INKHAUS:` comment on every changed
 * line, and there is exactly one such fork in the app today.
 *
 * Anything the catalogue does not know is passed through untouched. That is not
 * a fallback, it is a requirement: `validateTiers` in @inkhaus/shared returns a
 * finished English sentence, shared is never translated (s9), and that sentence
 * has to reach the reader unharmed.
 */

/** `useTranslations` widened the way `i18n/labels.ts` widens it, and for the same reason */
type MessageTranslator = {
  (key: string, values?: Record<string, string>): string;
  has(key: string): boolean;
};

/**
 * react-hook-form's `FieldErrors` is a tree: a leaf carries `message`, `type`
 * and a `ref`, a nested object carries more of the same, and an array field
 * carries a sparse array of them. Only `message` is touched, and every node is
 * copied rather than mutated - `ref` points at a live DOM node and the caller
 * still owns it.
 */
function translateTree(node: unknown, t: MessageTranslator, params: ParamTable): unknown {
  if (Array.isArray(node)) return node.map((entry) => translateTree(entry, t, params));
  if (node === null || typeof node !== "object") return node;

  const record = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "message" && typeof value === "string") {
      out[key] = t.has(value) ? t(value, params[value]) : value;
    } else if (key === "ref" || key === "type" || key === "types") {
      // `ref` is a DOM node and must not be walked; the other two are not copy
      out[key] = value;
    } else {
      out[key] = translateTree(value, t, params);
    }
  }
  return out;
}

type ParamTable = Record<string, Record<string, string> | undefined>;

/**
 * @param schema  the shared schema, unchanged
 * @param params  code -> ICU values, so a limit stays written once in
 *                `@inkhaus/shared` instead of being re-typed into two
 *                catalogues. See `CATALOG_VALIDATION_PARAMS`.
 */
export function useTranslatedResolver<T extends FieldValues>(
  schema: ZodType<unknown, T>,
  params: ParamTable = {},
): Resolver<T> {
  const t = useTranslations("Validation") as unknown as MessageTranslator;

  // Read through a ref, never captured in the memo below. A language switch is
  // a router.refresh(), which re-renders this component in place - the form is
  // keyed on the saved record, so react-hook-form keeps its instance and its
  // resolver. A `t` closed over at memo time would then keep answering in the
  // old language until something remounted, and the first thing anyone would
  // see is a form whose labels are Vietnamese and whose errors are English.
  const translator = useRef(t);
  useEffect(() => {
    translator.current = t;
  }, [t]);

  return useMemo(() => {
    const base = zodResolver(schema) as Resolver<T>;
    return async (values, context, options) => {
      const t = translator.current;
      const result = await base(values, context, options);
      if (!result.errors || Object.keys(result.errors).length === 0) return result;
      // One cast, and it is the discriminated union that forces it:
      // ResolverResult is `{values, errors: {}} | {values: {}, errors: FieldErrors}`,
      // so a spread widens `errors` and TypeScript can no longer tell which arm
      // this is. The shape is unchanged - only `message` strings were replaced.
      return {
        values: result.values,
        errors: translateTree(result.errors, t, params) as FieldErrors<T>,
      } as ResolverResult<T>;
    };
    // `t` is deliberately absent: it is read through the ref above, so the
    // resolver never needs rebuilding when the language changes
  }, [schema, params]);
}
