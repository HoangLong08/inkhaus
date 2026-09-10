export { cn } from "cn";

/**
 * A re-export, not an implementation.
 *
 * The shadcn registry moved `cn` out of a generated `lib/utils.ts` and into its
 * own package (github.com/shadcn-ui/cn, a compiled drop-in for clsx +
 * tailwind-merge), so every file under components/ui imports it `from "cn"`.
 * Fighting that would mean rewriting twenty imports after every `shadcn add`.
 *
 * This file stays because `components.json` still names `@/lib/utils` as the
 * utils alias, so a future registry item generated the old way resolves too.
 * Either import works and both reach the same function. App helpers belong in
 * ./format.ts, not here.
 */
