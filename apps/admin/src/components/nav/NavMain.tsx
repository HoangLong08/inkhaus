"use client";

import { ORDER_STATUSES, QUOTE_STATUSES } from "@inkhaus/shared/orders";
import { ChevronRight, FileText, LayoutDashboard, Package } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { humanize } from "@/lib/format";

/**
 * The four an operator actually works from. The other four order statuses -
 * DRAFT, DELIVERED, CANCELLED, REFUNDED - are archive states: real, filterable
 * from the list page, but not a queue anybody starts their morning in.
 */
const ORDER_QUEUES = ORDER_STATUSES.filter((status) =>
  (["PENDING_PAYMENT", "PAID", "IN_PRODUCTION", "SHIPPED"] as string[]).includes(status),
);

const NAV = [
  { title: "Overview", href: "/", icon: LayoutDashboard, statuses: [] as readonly string[] },
  { title: "Orders", href: "/orders", icon: Package, statuses: ORDER_QUEUES },
  { title: "Bulk quotes", href: "/quotes", icon: FileText, statuses: QUOTE_STATUSES },
];

export function NavMain() {
  const pathname = usePathname();
  // Reading the query string is what lets a status child light up. Note this
  // needs a <Suspense> boundary in a prerendered tree - safe here only because
  // (dash) is force-dynamic, so nothing in this subtree is ever prerendered.
  const status = useSearchParams().get("status");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Back office</SidebarGroupLabel>
      <SidebarMenu>
        {NAV.map((item) => {
          // "/" would prefix-match everything, so Overview is exact. Orders stays
          // lit on /orders/INK-2024-0001, which is where an operator spends most
          // of their time and would otherwise lose their place in the nav.
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Collapsible key={item.href} asChild defaultOpen={active} className="group/collapsible">
              <SidebarMenuItem>
                {/* A link, not a collapsible trigger: all three of these are real
                    destinations, and sidebar-07's stock markup makes the parent
                    unclickable. The chevron gets its own hit target below. */}
                <SidebarMenuButton asChild tooltip={item.title} isActive={active && !status}>
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>

                {item.statuses.length > 0 ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction
                        className="data-[state=open]:rotate-90"
                        aria-label={`Show ${item.title.toLowerCase()} by status`}
                      >
                        <ChevronRight className="transition-transform duration-200" />
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.statuses.map((code) => (
                          <SidebarMenuSubItem key={code}>
                            <SidebarMenuSubButton asChild isActive={active && status === code}>
                              <Link href={`${item.href}?status=${code}`} data-status={code}>
                                <span>{humanize(code)}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                ) : null}
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
