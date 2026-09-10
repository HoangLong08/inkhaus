"use client";

import { ChevronsUpDown, LogOut } from "lucide-react";
import { useState, useTransition } from "react";

import { logout } from "@/app/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { AdminUser } from "@/lib/api";

/** two letters from a display name, or one from an email that has no name */
function initials(user: AdminUser) {
  if (!user.name) return user.email.slice(0, 2).toUpperCase();
  const parts = user.name.trim().split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function NavUser({ user }: { user: AdminUser }) {
  const { isMobile } = useSidebar();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              data-testid="user-menu"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-md">
                <AvatarFallback className="bg-sidebar-accent rounded-md text-xs font-semibold">
                  {initials(user)}
                </AvatarFallback>
              </Avatar>
              {/* sidebar-07 stacks name over email here. Role, not email, is the
                  load-bearing fact in a tool where it decides what you may do -
                  an operator needs to know at a glance whether they can refund.
                  The email moves into the menu, one click away.
                  One element, one line: e2e reads this exact string. */}
              <span
                className="flex-1 truncate text-left text-sm font-medium"
                data-testid="current-user"
              >
                {user.name ?? user.email} · {user.role.toLowerCase()}
              </span>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
            // Radix hands focus back to the trigger as the menu closes. When the
            // close is the one that opens the confirmation, that fires after the
            // dialog has mounted and steals focus out of it.
            onCloseAutoFocus={(event) => {
              if (confirming) event.preventDefault();
            }}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="grid gap-0.5 px-2 py-1.5 text-left text-sm leading-tight">
                {user.name ? <span className="truncate font-medium">{user.name}</span> : null}
                <span className="text-muted-foreground truncate text-xs">{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* The item only asks the question; the answer runs from the dialog.
                The dialog is a sibling of the menu, not a child of it: the menu
                unmounts its portal on select, and anything inside it goes with
                it - including a logout in flight. */}
            <DropdownMenuItem data-testid="sign-out" onSelect={() => setConfirming(true)}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog
          open={confirming}
          // a sign-out already on its way is not cancellable
          onOpenChange={(open) => {
            if (!pending) setConfirming(open);
          }}
        >
          <AlertDialogContent data-testid="sign-out-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out?</AlertDialogTitle>
              <AlertDialogDescription>
                This ends the session for {user.name ?? user.email} on this device. You will need to
                sign in with Google again to get back in.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="sign-out-cancel" disabled={pending}>
                Stay signed in
              </AlertDialogCancel>
              {/* `onClick` + a transition rather than <form action={logout}>:
                  calling the "use server" function is a plain RPC, and the
                  redirect("/login") inside it still runs on the server - the
                  httpOnly cookie is cleared exactly as before. preventDefault
                  keeps the dialog up while the request is in flight, so the
                  screen behind it is never briefly interactive. */}
              <AlertDialogAction
                data-testid="sign-out-confirm"
                disabled={pending}
                onClick={(event) => {
                  event.preventDefault();
                  startTransition(() => {
                    void logout();
                  });
                }}
              >
                <LogOut />
                {pending ? "Signing out…" : "Sign out"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
