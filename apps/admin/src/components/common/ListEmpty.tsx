import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * What a list shows instead of its table when there is nothing to show: an icon,
 * a title, a sentence saying *why* it is empty, and - where there is one - the
 * way out.
 *
 * Six pages had hand-rolled the same `<Card><Empty className="py-10">…` block,
 * which is exactly the kind of bespoke widget §1 exists to prevent; this is that
 * block, once. It replaces the table rather than sitting inside it, which is a
 * deliberate difference from the reference design: a full-width cell reading
 * "no rows" keeps a header the reader then has to ignore.
 *
 * `reason` is the machine-readable half and goes on `data-reason`, so a test can
 * tell "nothing here yet" from "your filters exclude everything" without reading
 * the copy. Give an `action` only when there is somewhere useful to go - clearing
 * the filters, or jumping to the last page that still has rows. An empty list
 * with no way out gets no button rather than a dead one.
 *
 * `testId` defaults to `list-empty`. A page overrides it only when its own id is
 * already asserted by a spec - `/orders` does.
 */
export default function ListEmpty({
  icon: Icon,
  title,
  description,
  action,
  actionHref,
  actionTestId,
  reason,
  testId = "list-empty",
}: {
  /** a lucide glyph - the same one the page's nav entry uses, where there is one */
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  /** the label on the way out; omitted when there is nowhere useful to go */
  action?: string;
  actionHref?: string;
  actionTestId?: string;
  /** "none" | "filtered" | "page" | … - why, for tests */
  reason?: string;
  testId?: string;
}) {
  return (
    <Card>
      <Empty className="py-10" data-testid={testId} data-reason={reason}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        {action && actionHref ? (
          <EmptyContent>
            <Button asChild variant="outline" size="sm">
              <Link href={actionHref} data-testid={actionTestId}>
                {action}
              </Link>
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    </Card>
  );
}
