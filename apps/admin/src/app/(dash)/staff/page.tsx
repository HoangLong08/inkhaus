import { can } from "@inkhaus/shared/admin";
import { UserCog } from "lucide-react";

import ListHeader from "@/components/common/ListHeader";
import OwnersOnly from "@/components/common/OwnersOnly";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { requireAdmin } from "@/lib/dal";

export const metadata = { title: "Staff — INKHAUS Back Office" };

/**
 * A placeholder the nav and breadcrumb can already point at; the staff
 * workstream replaces the body. The gate stays: staff reach this URL by typing
 * it, and get the page's own heading and an explanation - not a redirect.
 */
export default async function StaffPage() {
  // cached by the DAL, so this costs nothing beyond the layout's own call
  const user = await requireAdmin();

  if (!can(user.role, "staff.view")) {
    return (
      <OwnersOnly title="Staff">
        Inviting, promoting and deactivating back-office accounts is limited to owners.
      </OwnersOnly>
    );
  }

  return (
    <div className="space-y-6">
      <ListHeader title="Staff" />
      <Card>
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserCog />
            </EmptyMedia>
            <EmptyTitle>Not built yet</EmptyTitle>
            <EmptyDescription>
              Who can sign in to the back office, and as what, will be managed here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    </div>
  );
}
