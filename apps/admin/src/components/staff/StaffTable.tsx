"use client";

import { useQuery } from "@tanstack/react-query";

import TableCard from "@/components/common/TableCard";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clientApi } from "@/lib/client-api";
import { queryKeys } from "@/lib/query-keys";

import StaffRow, { type StaffActor } from "./StaffRow";

/**
 * The member list, read from the cache entry the page prefetched. A client leaf
 * rather than server markup because every row's controls write to that entry
 * optimistically, and each write can change what the OTHER rows may do - the
 * active-owner count is shared by all of them.
 */
export default function StaffTable({
  actor,
  canManage,
}: {
  actor: StaffActor;
  canManage: boolean;
}) {
  // "Last sign-in: 3 days ago" is measured from when the list was read, not
  // from a clock read during render: `dataUpdatedAt` travels with the
  // dehydrated query, so the server render and the hydration agree to the
  // millisecond, and it moves on by itself with every refetch.
  const { data, dataUpdatedAt: now } = useQuery({
    queryKey: queryKeys.staff.all(),
    queryFn: () => clientApi.staff.list(),
  });

  // warm from the page's HydrationBoundary; the guard is for the type
  if (!data) return null;

  return (
    <TableCard fill>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Access</TableHead>
            <TableHead>Last sign-in</TableHead>
            <TableHead>Invited by</TableHead>
            <TableHead className="text-right">Sessions</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.data.map((member) => (
            <StaffRow
              key={member.id}
              member={member}
              actor={actor}
              activeOwners={data.activeOwners}
              canManage={canManage}
              now={now}
            />
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}
