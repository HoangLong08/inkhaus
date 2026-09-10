import { Palette } from "lucide-react";

import ListHeader from "@/components/common/ListHeader";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const metadata = { title: "Colours — INKHAUS Back Office" };

/** A placeholder the nav and breadcrumb can already point at; the catalog workstream replaces it. */
export default function ColorsPage() {
  return (
    <div className="space-y-6">
      <ListHeader title="Colours" />
      <Card>
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Palette />
            </EmptyMedia>
            <EmptyTitle>Not built yet</EmptyTitle>
            <EmptyDescription>
              The colour swatches products are offered in will be added and archived here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    </div>
  );
}
