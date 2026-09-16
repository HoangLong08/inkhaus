"use client";

import { staffChangeError } from "@inkhaus/shared/admin";
import { ADMIN_ROLES } from "@inkhaus/shared/orders";
import { Loader2, LogOut } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import type { AdminRole, StaffMember } from "@/lib/api";
import { at, humanize, on, relative } from "@/lib/format";
import { adminRoleSchema } from "@/lib/schemas/api";
import { staffRevokeSelfMessage } from "@/lib/schemas/forms";

import DisabledReason from "./DisabledReason";
import { staffLabel, useStaffChange, useStaffRevoke } from "./staff-mutations";

export type StaffActor = { id: string; role: AdminRole };

/** for a viewer without `staff.manage` - unreachable while it and `staff.view` are both owner-only */
const NOT_ALLOWED = "Managing staff is limited to owners.";

/**
 * One account. Its own mutations, so one row's pending state never disables
 * another's controls.
 *
 * Every control is disabled - with the reason in a tooltip - exactly when the
 * server would refuse the change, because the reason comes from the same
 * `staffChangeError` the BFF and the API refuse it with. Your own row and the
 * last active owner are the everyday cases.
 */
export default function StaffRow({
  member,
  actor,
  activeOwners,
  canManage,
  now,
}: {
  member: StaffMember;
  actor: StaffActor;
  activeOwners: number;
  canManage: boolean;
  /** when the list was read; relative times are measured from it */
  now: number;
}) {
  const change = useStaffChange(member.id);
  const revoke = useStaffRevoke(member.id);
  const [confirmingDeactivation, setConfirmingDeactivation] = useState(false);
  const label = staffLabel(member);

  const refusal = (next: { role?: AdminRole; isActive?: boolean }) =>
    staffChangeError(actor, member, next, activeOwners)?.message ?? (canManage ? null : NOT_ALLOWED);

  // Two roles, so the select is only worth opening if moving to the other one
  // is allowed - and its tooltip says why not.
  const roleRefusal = refusal({ role: member.role === "OWNER" ? "STAFF" : "OWNER" });
  const activeRefusal = refusal({ isActive: !member.isActive });
  const revokeRefusal = !canManage
    ? NOT_ALLOWED
    : member.isSelf
      ? staffRevokeSelfMessage
      : member.activeSessions === 0
        ? "No live sessions to end."
        : null;

  return (
    <TableRow
      data-testid="staff-row"
      data-email={member.email}
      data-role={member.role}
      data-active={member.isActive}
      data-self={member.isSelf}
    >
      {/* name over email: two lines, so it states its own py- and TableCard's
          `py-0` steps aside for it */}
      <TableCell className="py-1.5 leading-tight">
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          {member.isSelf ? <Badge variant="secondary">You</Badge> : null}
        </div>
        {member.name ? <p className="text-muted-foreground text-xs">{member.email}</p> : null}
      </TableCell>

      <TableCell>
        <DisabledReason reason={roleRefusal}>
          <Select
            value={member.role}
            disabled={Boolean(roleRefusal) || change.isPending}
            onValueChange={(value) => change.mutate({ role: adminRoleSchema.parse(value) })}
          >
            <SelectTrigger
              size="sm"
              className="w-28"
              aria-label={`Role for ${label}`}
              data-testid="staff-role-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADMIN_ROLES.map((role) => (
                <SelectItem key={role} value={role} data-testid="staff-role-option" data-role={role}>
                  {humanize(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DisabledReason>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-2">
          <DisabledReason reason={activeRefusal}>
            <Switch
              checked={member.isActive}
              disabled={Boolean(activeRefusal) || change.isPending}
              aria-label={`${label} can sign in`}
              data-testid="staff-active"
              // Turning someone off signs them out everywhere at once, so it
              // asks first; turning them back on is harmless and does not.
              onCheckedChange={(checked) =>
                checked ? change.mutate({ isActive: true }) : setConfirmingDeactivation(true)
              }
            />
          </DisabledReason>
          {/* never the switch's colour alone */}
          <span className="text-muted-foreground text-xs">
            {member.isActive
              ? "Active"
              : member.deactivatedAt
                ? `Off since ${on(member.deactivatedAt)}`
                : "Deactivated"}
          </span>
        </div>

        <AlertDialog open={confirmingDeactivation} onOpenChange={setConfirmingDeactivation}>
          <AlertDialogContent data-testid="staff-deactivate-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate {label}?</AlertDialogTitle>
              <AlertDialogDescription>
                They are signed out of the back office everywhere, right now, and cannot sign in
                again until an owner turns their access back on. Everything they did stays on
                record.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="staff-deactivate-cancel">Keep access</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                data-testid="staff-deactivate-confirm"
                onClick={() => change.mutate({ isActive: false })}
              >
                Deactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>

      <TableCell className="text-muted-foreground text-sm">
        {member.lastLoginAt ? (
          <time dateTime={member.lastLoginAt} title={at(member.lastLoginAt)}>
            {relative(member.lastLoginAt, now)}
          </time>
        ) : (
          "Never"
        )}
      </TableCell>

      <TableCell className="text-muted-foreground max-w-48 truncate text-sm">
        {member.invitedBy ? staffLabel(member.invitedBy) : "—"}
      </TableCell>

      <TableCell className="text-right tabular-nums">{member.activeSessions}</TableCell>

      <TableCell className="text-right">
        <AlertDialog>
          <DisabledReason reason={revokeRefusal}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={Boolean(revokeRefusal) || revoke.isPending}
                data-testid="staff-revoke-sessions"
              >
                {revoke.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LogOut className="size-4" />
                )}
                Sign out
              </Button>
            </AlertDialogTrigger>
          </DisabledReason>
          <AlertDialogContent data-testid="staff-revoke-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Sign {label} out everywhere?</AlertDialogTitle>
              <AlertDialogDescription>
                This ends {member.activeSessions === 1 ? "their session" : `all ${member.activeSessions} of their sessions`}{" "}
                now. They can sign straight back in with Google — to keep them out, deactivate the
                account instead.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="staff-revoke-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction data-testid="staff-revoke-confirm" onClick={() => revoke.mutate()}>
                <LogOut className="size-4" />
                Sign out everywhere
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}
