import type en from "./messages/en.json";
import type { LOCALES } from "./src/i18n/config";

/**
 * Type-safe message keys. `useTranslations("Orders")` and `t("title")` are both
 * checked against `messages/en.json`, so a typo in a key is a typecheck failure
 * rather than an "Orders.titel" rendered into a table head.
 *
 * The two imports above are load-bearing and must stay, even though neither
 * name is used below: a .d.ts with no top-level import or export is a *script*,
 * and inside a script `declare module "next-intl"` REPLACES next-intl's types
 * instead of augmenting them. With an import present it is a module, and the
 * declaration merges.
 *
 * Deliberately no `Formats` and no `createMessagesDeclaration` /
 * `allowArbitraryExtensions`. Those buy strict typing of ICU placeholder
 * arguments; they are also the newest and least-travelled part of next-intl's
 * type story, and this repo is on TypeScript 7 (tsgo). `scripts/i18n-check.mjs`
 * asserts placeholder parity between the two catalogues instead, which is the
 * failure that actually happens.
 *
 * If `npm run typecheck` ever slows on the inferred type of a large JSON
 * literal, replace `typeof en` with a hand-written interface. Nothing else
 * changes.
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof LOCALES)[number];
    Messages: typeof en;
  }
}
