"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ADMIN_ROLES } from "@inkhaus/shared/orders";
import { Loader2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { humanize } from "@/lib/format";
import {
  STAFF_NAME_MAX,
  staffInviteInputSchema,
  type StaffInviteInput,
} from "@/lib/schemas/forms";

import { useStaffInvite } from "./staff-mutations";

const EMPTY: StaffInviteInput = { email: "", name: "", role: "STAFF" };

/**
 * Puts a Google account on the allowlist. Nothing is sent (decision D15) - the
 * dialog says so, because an owner who expects an invitation email will wait
 * for one that never comes.
 */
export default function InviteStaffDialog() {
  const [open, setOpen] = useState(false);
  const invite = useStaffInvite();

  const form = useForm<StaffInviteInput>({
    resolver: zodResolver(staffInviteInputSchema),
    defaultValues: EMPTY,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // an invite already on its way is not something closing the dialog undoes
        if (invite.isPending) return;
        setOpen(next);
        if (!next) form.reset(EMPTY);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" data-testid="staff-invite-open">
          <UserPlus className="size-4" />
          Invite
        </Button>
      </DialogTrigger>

      <DialogContent data-testid="staff-invite-dialog">
        <DialogHeader>
          <DialogTitle>Invite to the back office</DialogTitle>
          <DialogDescription>
            They sign in with Google using exactly this address. Nothing is emailed, so let them
            know yourself.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          {/* noValidate: the browser's own email check would pre-empt zod's
              message with one in a different voice */}
          <form
            noValidate
            className="space-y-4"
            onSubmit={form.handleSubmit((input) =>
              invite.mutate(input, {
                onSuccess: () => {
                  setOpen(false);
                  form.reset(EMPTY);
                },
              }),
            )}
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Google account</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="name@example.com"
                      data-testid="staff-invite-email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Name <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      maxLength={STAFF_NAME_MAX}
                      data-testid="staff-invite-name"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>Google fills it in on their first sign-in if left blank.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full" data-testid="staff-invite-role">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ADMIN_ROLES.map((role) => (
                        <SelectItem
                          key={role}
                          value={role}
                          data-testid="staff-invite-role-option"
                          data-role={role}
                        >
                          {humanize(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Owners can also export orders, see customer artwork, change prices, delete
                    reviews and manage staff.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={invite.isPending} data-testid="staff-invite-submit">
                {invite.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Invite
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
