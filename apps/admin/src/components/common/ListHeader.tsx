/**
 * The top of every list page: the one `<h1>`, an optional sentence saying what
 * the list is for, an optional meta line, and a slot for page-level actions such
 * as Export or New. One component so every list reads the same and none forgets
 * its heading.
 *
 * `description` is the slot five pages used to fill with a loose `<p>` of their
 * own, each with slightly different classes. It sits opposite the heading and
 * above the meta line; `items-baseline` on the row puts its first line on the
 * `<h1>`'s baseline, so a page with one and a page without still line up.
 *
 * `meta` is for a list with no footer - `8 sizes`, `12 colours · 2 archived`,
 * the staff head-count - a fact nothing else on the page states. A list that
 * renders a `ListFooter` passes none: the footer already prints its total and
 * its page, and the same two numbers a hand's breadth higher read as noise.
 *
 * The description and the meta line are both `text-xs`. They are two muted lines
 * stacked in the same aside, and a one-step size difference between them read as
 * an accident rather than a hierarchy.
 */
export default function ListHeader({
  title,
  description,
  meta,
  actions,
}: {
  title: string;
  /** one sentence: what this list is and what it is for */
  description?: React.ReactNode;
  /** a fact no footer states - only for a list without one */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const aside = description !== undefined || meta !== undefined || actions;

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      {aside ? (
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          {description !== undefined ? (
            <p className="text-muted-foreground max-w-[460px] text-xs sm:text-right">
              {description}
            </p>
          ) : null}
          {meta !== undefined || actions ? (
            <div className="flex flex-wrap items-center gap-3">
              {meta !== undefined ? (
                <p className="text-muted-foreground text-xs">{meta}</p>
              ) : null}
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
