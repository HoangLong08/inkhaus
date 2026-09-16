import { can } from "@inkhaus/shared/admin";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import ListHeader from "@/components/common/ListHeader";
import ListPage from "@/components/common/ListPage";
import OwnersOnly from "@/components/common/OwnersOnly";
import InviteStaffDialog from "@/components/staff/InviteStaffDialog";
import StaffTable from "@/components/staff/StaffTable";
import { adminApi } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";
import { count } from "@/lib/format";
import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

export const metadata = { title: "Staff — INKHAUS Back Office" };

/**
 * Who can sign in to the back office, and as what. `admin_users` is the
 * allowlist, so this is the most sensitive screen in the app.
 *
 * Owner-only three times over: this page renders `OwnersOnly` without
 * `staff.view`, the BFF refuses without `staff.manage`, and the API refuses
 * again with `@Can`. The table is a client leaf over the prefetched list, since
 * every change on it is optimistic; the header's counts stay server rendered
 * and follow along through `router.refresh()`.
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

  const queryClient = getQueryClient();
  // fetchQuery, not prefetchQuery: the header counts below need the value too
  const staff = await queryClient.fetchQuery({
    queryKey: queryKeys.staff.all(),
    queryFn: () => adminApi.staff.list(),
  });

  const active = staff.data.filter((member) => member.isActive).length;
  const canManage = can(user.role, "staff.manage");

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ListPage>
        <ListHeader
          title="Staff"
          description="Who can sign in to the back office, and what each of them may do."
          meta={`${count(active)} active · ${count(staff.data.length - active)} deactivated · ${count(staff.activeOwners)} active ${staff.activeOwners === 1 ? "owner" : "owners"}`}
          actions={canManage ? <InviteStaffDialog /> : null}
        />

        <StaffTable actor={{ id: user.id, role: user.role }} canManage={canManage} />

        {/* Below the table, not in ListHeader's `description`: this is a caveat
            about what the controls above refuse to do, not a sentence saying
            what the list is. Three right-aligned lines in the heading drowned
            the heading. */}
        <p className="text-muted-foreground max-w-prose shrink-0 text-xs">
          Nobody can change their own role or turn off their own access, and the last active owner
          can be neither demoted nor deactivated. Addresses in{" "}
          <code className="font-mono">ADMIN_BOOTSTRAP_EMAILS</code> are restored as active owners by
          every <code className="font-mono">npm run db:seed</code> — take an address out of that
          variable before deactivating it here.
        </p>
      </ListPage>
    </HydrationBoundary>
  );
}
