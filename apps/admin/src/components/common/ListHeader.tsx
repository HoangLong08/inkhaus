/**
 * The top of every list page: the one `<h1>`, an optional sentence saying what
 * the list is for, a meta line (`12 total · page 1 of 2`), and a slot for
 * page-level actions such as Export or New. One component so every list reads the
 * same and none forgets its heading.
 *
 * `description` is the slot five pages used to fill with a loose `<p>` of their
 * own, each with slightly different classes. It sits opposite the heading and
 * above the meta line; `items-baseline` on the row puts its first line on the
 * `<h1>`'s baseline, so a page with one and a page without still line up.
 */
export default function ListHeader({
  title,
  description,
  meta,
  metaTestId,
  actions,
}: {
  title: string;
  /** one sentence: what this list is and what it is for */
  description?: React.ReactNode;
  meta?: React.ReactNode;
  /** `orders-meta`, `quotes-meta`, … - e2e reads totals from it */
  metaTestId?: string;
  actions?: React.ReactNode;
}) {
  const aside = description !== undefined || meta !== undefined || actions;

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
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
                <p className="text-muted-foreground text-sm" data-testid={metaTestId}>
                  {meta}
                </p>
              ) : null}
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
