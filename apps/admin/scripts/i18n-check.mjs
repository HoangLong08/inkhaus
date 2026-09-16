#!/usr/bin/env node
/**
 * The message catalogues, checked mechanically. `npm run i18n:check`.
 *
 * This exists because the e2e suite runs a PRODUCTION build, where a missing key
 * renders "Orders.title" instead of crashing - and every spec in that suite
 * matches on `data-testid`, so it sails straight past. Four layers guard against
 * a half-translated screen; this is the one that runs in CI without a browser.
 *
 * Node, no dependencies, no build step: it must be runnable on a checkout that
 * has never built @inkhaus/shared, which is why the enum lists below are parsed
 * out of that package's TypeScript source rather than imported from its dist.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const admin = resolve(here, "..");
const shared = resolve(admin, "../../packages/shared/src");

const failures = [];
const fail = (assertion, message) => failures.push(`[${assertion}] ${message}`);

/* ------------------------------------------------------------------ catalogues */

const read = (locale) =>
  JSON.parse(readFileSync(join(admin, "messages", `${locale}.json`), "utf8"));

const LOCALES = ["en", "vi"];
const catalogues = Object.fromEntries(LOCALES.map((l) => [l, read(l)]));

/** { "Nav.section.orders": "Orders", ... } */
function flatten(value, prefix = "", out = {}) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === "object") flatten(child, path, out);
    else out[path] = child;
  }
  return out;
}

const flat = Object.fromEntries(LOCALES.map((l) => [l, flatten(catalogues[l])]));

/** resolve a dotted path, whether it lands on a leaf or a namespace object */
function lookup(catalogue, path) {
  let node = catalogue;
  for (const segment of path.split(".")) {
    if (node === null || typeof node !== "object" || !(segment in node)) return undefined;
    node = node[segment];
  }
  return node;
}

/* --------------------------------------------------- 1. identical key sets */

{
  const [a, b] = LOCALES;
  const keysA = new Set(Object.keys(flat[a]));
  const keysB = new Set(Object.keys(flat[b]));

  for (const key of keysA) if (!keysB.has(key)) fail(1, `${b}.json is missing "${key}"`);
  for (const key of keysB) if (!keysA.has(key)) fail(1, `${a}.json is missing "${key}"`);
}

/* ------------------------------------------- 2. identical placeholder sets */

// An ARGUMENT placeholder only: the identifier must be followed by `}` or `,`.
// That is what keeps `one {no followers}` from reading "no" as a placeholder,
// which would make every plural message disagree across locales by definition.
const PLACEHOLDER = /\{\s*([A-Za-z_]\w*)\s*(?=[},])/g;

const placeholders = (value) =>
  new Set(Array.from(String(value).matchAll(PLACEHOLDER), (m) => m[1]));

for (const key of Object.keys(flat.en)) {
  if (!(key in flat.vi)) continue;
  const en = placeholders(flat.en[key]);
  const vi = placeholders(flat.vi[key]);

  for (const name of en) if (!vi.has(name)) fail(2, `vi.json "${key}" is missing {${name}}`);
  for (const name of vi) if (!en.has(name)) fail(2, `en.json "${key}" is missing {${name}}`);
}

/* ------------------------- 3. no ICU formatting functions, in either locale */

// The single most important rule here. `{total, number}` would format with
// next-intl's locale and print "12.345" under vi - quietly undoing the decision
// that numbers, money and dates stay en-US / USD / UTC. Every number is
// formatted by src/lib/format.ts and interpolated as a string.
const ICU_FORMAT = /\{\s*\w+\s*,\s*(number|date|time)\b/;

for (const locale of LOCALES) {
  for (const [key, value] of Object.entries(flat[locale])) {
    const text = String(value);
    if (ICU_FORMAT.test(text)) {
      fail(3, `${locale}.json "${key}" uses an ICU formatting function - format it with lib/format.ts and pass a string`);
    }
    if (text.includes("::")) {
      fail(3, `${locale}.json "${key}" carries an ICU skeleton (::) - same rule`);
    }
  }
}

/* ------------------------------------------- 4. no `#` inside a plural */

// `#` is formatted by the message's own locale, so it is rule 3 wearing a hat.
// Pass the pre-formatted string alongside the raw count instead.
for (const locale of LOCALES) {
  for (const [key, value] of Object.entries(flat[locale])) {
    const text = String(value);
    if (/\bplural\b/.test(text) && text.includes("#")) {
      fail(4, `${locale}.json "${key}" uses # inside a plural - pass a pre-formatted string instead`);
    }
  }
}

/* --------------------------------- 5. the code tables cover the shared enums */

/** pull `export const NAME = ["A", "B"] as const;` out of a .ts source */
function enumFrom(file, name) {
  const source = readFileSync(join(shared, file), "utf8");
  const match = new RegExp(`export const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`).exec(
    source,
  );
  if (!match) {
    fail(5, `could not find ${name} in packages/shared/src/${file}`);
    return [];
  }
  return Array.from(match[1].matchAll(/"([^"]+)"/g), (m) => m[1]);
}

const ORDER_STATUSES = enumFrom("orders.ts", "ORDER_STATUSES");
const QUOTE_STATUSES = enumFrom("orders.ts", "QUOTE_STATUSES");
const ADMIN_ROLES = enumFrom("orders.ts", "ADMIN_ROLES");
const CARRIERS = enumFrom("orders.ts", "CARRIERS");
const REVIEW_STATUSES = enumFrom("admin.ts", "REVIEW_STATUSES");
const PRINT_METHODS = enumFrom("taxonomy.ts", "PRINT_METHODS");

const CODE_TABLES = {
  // ACTIVE/INACTIVE are not an enum anywhere - they are how this app spells the
  // boolean `isActive` on staff, colours, sizes and products.
  Status: [...ORDER_STATUSES, ...QUOTE_STATUSES, ...REVIEW_STATUSES, "ACTIVE", "INACTIVE"],
  Role: ADMIN_ROLES,
  Carrier: CARRIERS,
  PrintMethod: PRINT_METHODS,
};

for (const [namespace, codes] of Object.entries(CODE_TABLES)) {
  for (const locale of LOCALES) {
    const table = catalogues[locale][namespace];
    if (!table) {
      fail(5, `${locale}.json has no "${namespace}" namespace`);
      continue;
    }
    for (const code of codes) {
      if (!(code in table)) fail(5, `${locale}.json "${namespace}.${code}" is missing`);
    }
  }
}

/* ------------------------ 6. every namespace and labelKey used in src resolves */

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* sourceFiles(path);
    else if (/\.(ts|tsx)$/.test(entry)) yield path;
  }
}

const USES = [
  // useTranslations("X") / getTranslations("X")
  /\b(?:useTranslations|getTranslations)\(\s*"([^"]+)"/g,
  // getTranslations({ namespace: "X" })
  /namespace:\s*"([^"]+)"/g,
  // nav-config.ts and friends: labelKey: "Nav.section.orders"
  /\b(?:labelKey|recordLabelKey):\s*"([^"]+)"/g,
];

for (const file of sourceFiles(join(admin, "src"))) {
  const source = readFileSync(file, "utf8");
  const rel = file.slice(admin.length + 1).replace(/\\/g, "/");

  for (const pattern of USES) {
    for (const [, path] of source.matchAll(pattern)) {
      for (const locale of LOCALES) {
        if (lookup(catalogues[locale], path) === undefined) {
          fail(6, `${rel} refers to "${path}", which ${locale}.json does not have`);
        }
      }
    }
  }
}

/* ------------------------------- 7. chrome labels fit a fixed-width slot */

// A sidebar item, a table head, a filter chip. Vietnamese runs 15-30% longer
// than English and this app is a 14px root with h-9 rows, so a label that does
// not fit is a design change rather than a translation: shorten the English too,
// and let the two languages share one layout.
const CHROME_LABEL_MAX = 16;
const CHROME_LABEL_PATHS = ["Nav.group", "Nav.section", "Nav.child"];

for (const locale of LOCALES) {
  for (const base of CHROME_LABEL_PATHS) {
    const node = lookup(catalogues[locale], base);
    if (node === undefined) continue;

    const leaves = typeof node === "object" ? flatten(node, base) : { [base]: node };
    for (const [key, value] of Object.entries(leaves)) {
      if (String(value).length > CHROME_LABEL_MAX) {
        fail(
          7,
          `${locale}.json "${key}" is ${String(value).length} characters ("${value}") - a chrome label is at most ${CHROME_LABEL_MAX}`,
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ report */

if (failures.length > 0) {
  console.error(`i18n:check failed - ${failures.length} problem(s)\n`);
  for (const line of failures) console.error(`  ${line}`);
  console.error("");
  process.exit(1);
}

const count = Object.keys(flat.en).length;
console.log(`i18n:check ok - ${count} keys x ${LOCALES.length} locales, 7 assertions`);
