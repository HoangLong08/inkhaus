/**
 * The one shape every control in a list's toolbar takes: 32px tall, 12px label,
 * 14px glyph. Written once because the row only reads as a row when all of it
 * agrees - the date picker used to be `h-8` beside an `h-9` search box, and the
 * 4px step was visible across the whole width of the page.
 *
 * Pair it with `size="sm"`, which is what sets the horizontal padding and the
 * radius; this only overrides the height, the type scale and the icon size.
 */
export const TOOLBAR_BUTTON = "h-8 gap-1.5 text-xs [&_svg]:size-3.5";

/**
 * The search box and any other `Input` sitting in that same row.
 *
 * `md:text-xs` belongs in here rather than at each call site: shadcn's `Input`
 * ships `text-base … md:text-sm`, so overriding only `text-xs` leaves the box a
 * size bigger than the buttons beside it from the `md` breakpoint up - which is
 * every screen this tool is used on.
 */
export const TOOLBAR_INPUT = "h-8 text-xs md:text-xs";
