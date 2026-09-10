import { Percent } from "lucide-react";

import ListHeader from "@/components/common/ListHeader";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const metadata = { title: "Price tiers — INKHAUS Back Office" };

/** A placeholder the nav and breadcrumb can already point at; the catalog workstream replaces it. */
export default function PricingPage() {
  return (
    <div className="space-y-6">
      <ListHeader title="Price tiers" />
      <Card>
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Percent />
            </EmptyMedia>
            <EmptyTitle>Not built yet</EmptyTitle>
            <EmptyDescription>
              The volume discount ladder every order is priced on will be edited here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    </div>
  );
}
