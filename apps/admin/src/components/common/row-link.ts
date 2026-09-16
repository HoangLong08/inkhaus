/**
 * The stretched row link, written once.
 *
 * A real `<a>` whose `::after` is `absolute inset-0` over a `relative` `<tr>`:
 * one tab stop per row, a real href, middle-click and open-in-new-tab both work,
 * and no client component calling `router.push`. Put `relative` on the `<tr>`
 * and this on the link in the row's first cell.
 *
 * It was four strings, and they had drifted into three different focus
 * behaviours: `/orders` ringed the whole row, `/customers` ringed it at `ring-2`,
 * `/quotes` ringed a `rounded-sm` box around the *text* rather than the row -
 * the ring was on the `<a>` instead of on its `::after` - and `/catalog` ringed
 * nothing at all, because its `Button variant="link"` wrapper swallowed the
 * outline. `/orders`' version is the one kept: `ring-ring/50` at `ring-[3px]` is
 * what every shadcn control in this app already draws.
 *
 * `ring-[3px]` is px and stays 3px at every step of the root font-size ladder.
 * That is deliberate - a focus ring that thins out with the density stops being
 * a focus ring - and it is one of the two exceptions §2 allows.
 *
 * The call site adds only what is its own: `font-mono font-semibold` for an
 * order number, `truncate font-medium` for an email. Anything a secondary
 * control in the same row needs to stay clickable is lifted with `relative z-10`,
 * on the control or on its cell.
 */
export const ROW_LINK =
  "outline-none underline-offset-4 hover:underline after:absolute after:inset-0 " +
  "focus-visible:after:ring-ring/50 focus-visible:after:ring-[3px] focus-visible:after:ring-inset";
