import { Users } from "lucide-react";

import ListHeader from "@/components/common/ListHeader";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const metadata = { title: "Customers — INKHAUS Back Office" };

/** A placeholder the nav and breadcrumb can already point at; the customers workstream replaces it. */
export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <ListHeader title="Customers" />
      <Card>
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>Not built yet</EmptyTitle>
            <EmptyDescription>
              Search, profiles and order history for every customer will live here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    </div>
  );
}
