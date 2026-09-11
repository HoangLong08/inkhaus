import { ADMIN_ROLES } from "@inkhaus/shared/orders";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { StaffList, StaffMember } from "@/lib/api";
import { ClientApiError, clientApi } from "@/lib/client-api";
import { queryKeys } from "@/lib/query-keys";
import type { StaffChangeInput, StaffInviteInput } from "@/lib/schemas/forms";

/**
 * The staff screen's three writes. They share one cache entry - the list the
 * page prefetched - and every write keeps `activeOwners` in it true, because
 * that count is what `staffChangeError` decides the other rows' controls with.
 */

const KEY = queryKeys.staff.all();

/** "Jo Bloggs", or the address for an account Google has not named yet */
export const staffLabel = (member: Pick<StaffMember, "name" | "email">) =>
  member.name ?? member.email;

/** the API counts active owners the same way, over the same rows */
function withActiveOwners(data: StaffMember[]): StaffList {
  return { data, activeOwners: data.filter((m) => m.role === "OWNER" && m.isActive).length };
}

function replaceMember(list: StaffList, member: StaffMember): StaffList {
  return withActiveOwners(list.data.map((m) => (m.id === member.id ? member : m)));
}

/** the API's order: active first, owners first, then by name (unnamed last), then email */
function byListOrder(a: StaffMember, b: StaffMember) {
  return (
    Number(b.isActive) - Number(a.isActive) ||
    ADMIN_ROLES.indexOf(a.role) - ADMIN_ROLES.indexOf(b.role) ||
    Number(a.name === null) - Number(b.name === null) ||
    (a.name ?? "").localeCompare(b.name ?? "") ||
    a.email.localeCompare(b.email)
  );
}

/** the member as it will be once `change` lands - what the row shows meanwhile */
function applyChange(member: StaffMember, change: StaffChangeInput): StaffMember {
  const next = { ...member };
  if (change.name !== undefined) next.name = change.name?.trim() || null;
  if (change.role !== undefined) next.role = change.role;
  if (change.isActive !== undefined && change.isActive !== member.isActive) {
    next.isActive = change.isActive;
    next.deactivatedAt = change.isActive ? null : new Date().toISOString();
    // the API ends every session in the same transaction as the deactivation
    if (!change.isActive) next.activeSessions = 0;
  }
  return next;
}

/** a 401 has already sent the tab to /login; a toast would flash at a page on its way out */
const silent = (error: Error) => error instanceof ClientApiError && error.status === 401;

function describeChange(member: StaffMember, change: StaffChangeInput) {
  const who = staffLabel(member);
  if (change.isActive === false) return `${who} is deactivated and signed out everywhere`;
  if (change.isActive === true) return `${who} can sign in again`;
  if (change.role !== undefined) {
    return `${who} is now ${member.role === "OWNER" ? "an owner" : "staff"}`;
  }
  return `Saved ${who}`;
}

/**
 * Role, access or name for one account. Optimistic, because the control the
 * operator just touched is where the answer shows, and a switch that sits
 * still for a round trip reads as one that did not take.
 *
 * Rollback restores this member alone rather than a snapshot of the whole
 * list: a failure on one row must not undo a change another row made while it
 * was in flight.
 */
export function useStaffChange(id: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (change: StaffChangeInput) => clientApi.staff.update(id, change),

    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const previous = queryClient.getQueryData<StaffList>(KEY)?.data.find((m) => m.id === id);
      if (previous) {
        queryClient.setQueryData<StaffList>(
          KEY,
          (list) => list && replaceMember(list, applyChange(previous, change)),
        );
      }
      return { previous };
    },

    onError: (error, _change, context) => {
      const previous = context?.previous;
      if (previous) {
        queryClient.setQueryData<StaffList>(KEY, (list) => list && replaceMember(list, previous));
      }
      if (silent(error)) return;
      toast.error(`Could not update ${previous ? staffLabel(previous) : "that account"}`, {
        description: error.message,
      });
    },

    onSuccess: (member, change) => {
      queryClient.setQueryData<StaffList>(KEY, (list) => list && replaceMember(list, member));
      toast.success(describeChange(member, change));
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      // the counts in the page header are server rendered
      router.refresh();
    },
  });
}

/** sign one colleague out everywhere; their access is untouched */
export function useStaffRevoke(id: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => clientApi.staff.revokeSessions(id),

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const previous = queryClient.getQueryData<StaffList>(KEY)?.data.find((m) => m.id === id);
      if (previous) {
        queryClient.setQueryData<StaffList>(
          KEY,
          (list) => list && replaceMember(list, { ...previous, activeSessions: 0 }),
        );
      }
      return { previous };
    },

    onError: (error, _vars, context) => {
      const previous = context?.previous;
      if (previous) {
        queryClient.setQueryData<StaffList>(KEY, (list) => list && replaceMember(list, previous));
      }
      if (silent(error)) return;
      toast.error("Could not end their sessions", { description: error.message });
    },

    onSuccess: ({ revoked }, _vars, context) => {
      const previous = context?.previous;
      if (previous) {
        // a refetch could have landed between onMutate and now
        queryClient.setQueryData<StaffList>(
          KEY,
          (list) => list && replaceMember(list, { ...previous, activeSessions: 0 }),
        );
      }
      const sessions = `${revoked} session${revoked === 1 ? "" : "s"}`;
      toast.success(previous ? `Ended ${sessions} for ${staffLabel(previous)}` : `Ended ${sessions}`);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      router.refresh();
    },
  });
}

/** put an address on the allowlist */
export function useStaffInvite() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: StaffInviteInput) => clientApi.staff.invite(input),

    // Nothing optimistic to show: the row has no id until the API assigns one,
    // and a row whose controls cannot work yet is worse than the dialog's own
    // pending button. Holding off refetches is still worth it, so one landing
    // mid-invite cannot overwrite the row onSuccess adds.
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: KEY });
    },

    onError: (error) => {
      if (silent(error)) return;
      toast.error("Could not invite them", { description: error.message });
    },

    onSuccess: (member) => {
      queryClient.setQueryData<StaffList>(
        KEY,
        (list) =>
          list &&
          withActiveOwners([...list.data.filter((m) => m.id !== member.id), member].sort(byListOrder)),
      );
      toast.success(`${member.email} can now sign in`, {
        description: "Nothing was emailed — tell them to use Google with exactly this address.",
      });
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      router.refresh();
    },
  });
}
