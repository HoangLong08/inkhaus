import { Ruler } from "lucide-react";

import ListHeader from "@/components/common/ListHeader";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const metadata = { title: "Sizes — INKHAUS Back Office" };

/** A placeholder the nav and breadcrumb can already point at; the catalog workstream replaces it. */
export default function SizesPage() {
  return (
    <div className="space-y-6">
      <ListHeader title="Sizes" />
      <Card>
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Ruler />
            </EmptyMedia>
            <EmptyTitle>Not built yet</EmptyTitle>
            <EmptyDescription>
              Size codes, their labels and any per-unit upcharge will be managed here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    </div>
  );
}
