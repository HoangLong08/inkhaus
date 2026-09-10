"use client";

import { ChevronsUpDown, LogOut } from "lucide-react";
import { useTransition } from "react";

import { logout } from "@/app/actions";
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
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="grid gap-0.5 px-2 py-1.5 text-left text-sm leading-tight">
                {user.name ? <span className="truncate font-medium">{user.name}</span> : null}
                <span className="text-muted-foreground truncate text-xs">{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* `onSelect` + a transition rather than <form action={logout}>:
                Radix closes the menu on select and unmounts the portal, which can
                cancel a submit mid-flight. Calling the "use server" function is a
                plain RPC, and the redirect("/login") inside it still runs on the
                server - the httpOnly cookie is cleared exactly as before. */}
            <DropdownMenuItem
              data-testid="sign-out"
              disabled={pending}
              onSelect={(event) => {
                event.preventDefault();
                startTransition(() => {
                  void logout();
                });
              }}
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
