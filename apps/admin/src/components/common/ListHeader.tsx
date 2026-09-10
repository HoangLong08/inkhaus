/**
 * The top of every list page: the one `<h1>`, a meta line (`12 total · page 1
 * of 2`), and a slot for page-level actions such as Export or New. One
 * component so every list reads the same and none forgets its heading.
 */
export default function ListHeader({
  title,
  meta,
  metaTestId,
  actions,
}: {
  title: string;
  meta?: React.ReactNode;
  /** `orders-meta`, `quotes-meta`, … - e2e reads totals from it */
  metaTestId?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
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
  );
}
