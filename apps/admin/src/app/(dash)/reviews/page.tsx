import { Star } from "lucide-react";

import ListHeader from "@/components/common/ListHeader";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const metadata = { title: "Reviews — INKHAUS Back Office" };

/** A placeholder the nav and breadcrumb can already point at; the reviews workstream replaces it. */
export default function ReviewsPage() {
  return (
    <div className="space-y-6">
      <ListHeader title="Reviews" />
      <Card>
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Star />
            </EmptyMedia>
            <EmptyTitle>Not built yet</EmptyTitle>
            <EmptyDescription>
              New reviews will wait here for someone to publish or reject them.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    </div>
  );
}
