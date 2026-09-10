import { ShieldAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * What a page renders for a role that may not see it - in place of its content,
 * never as a redirect (decision D7). The operator stays on the URL they asked
 * for, gets the page's own heading, and is told why. Bouncing them to `/` with
 * an error in the query string was the old idiom, and it read like a bug.
 *
 * The UI half of the capability rule only. The BFF (`requireCapability`) and
 * the API (`@Can`) refuse the data regardless of what this renders.
 */
export default function OwnersOnly({
  title,
  children,
}: {
  /** the page's own heading - it is still that page */
  title: string;
  /** what the page is for, if the default sentence does not say enough */
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <Card>
        <Empty className="py-10" data-testid="owners-only">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldAlert />
            </EmptyMedia>
            <EmptyTitle>Owners only</EmptyTitle>
            <EmptyDescription>
              {children ??
                "This part of the back office is limited to owners. Ask an owner if something here needs changing."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    </div>
  );
}
