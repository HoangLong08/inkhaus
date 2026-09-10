"use client";

import type { AdminRoleCode } from "@inkhaus/shared/orders";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { activeChildren, ownsPath, visibleNav } from "@/components/nav/nav-config";
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

/**
 * The sidebar, drawn from `nav-config.ts` and filtered by `can()` - the UI third
 * of the capability rule. Staff never see Staff; the page would tell them
 * "owners only" anyway, but a link that always leads there is noise.
 */
export function NavMain({ role }: { role: AdminRoleCode }) {
  const pathname = usePathname();
  // Reading the query string is what lets a filter child light up. Note this
  // needs a <Suspense> boundary in a prerendered tree - safe here only because
  // (dash) is force-dynamic, so nothing in this subtree is ever prerendered.
  const searchParams = useSearchParams();
  const sections = useMemo(() => visibleNav(role), [role]);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Back office</SidebarGroupLabel>
      <SidebarMenu>
        {sections.map((section) => {
          const inSection = ownsPath(section.href, pathname);
          const lit = activeChildren(section, pathname, searchParams);
          const children = section.children ?? [];

          return (
            <Collapsible
              key={section.id}
              asChild
              defaultOpen={inSection}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                {/* A link, not a collapsible trigger: every section is a real
                    destination, and sidebar-07's stock markup makes the parent
                    unclickable. The chevron gets its own hit target below. */}
                <SidebarMenuButton
                  asChild
                  tooltip={section.title}
                  isActive={inSection && lit.size === 0}
                >
                  <Link href={section.href} data-testid="nav-link" data-section={section.id}>
                    <section.icon />
                    <span>{section.title}</span>
                  </Link>
                </SidebarMenuButton>

                {children.length > 0 ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction
                        className="data-[state=open]:rotate-90"
                        aria-label={`Show ${section.title.toLowerCase()} shortcuts`}
                      >
                        <ChevronRight className="transition-transform duration-200" />
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {children.map((child) => (
                          <SidebarMenuSubItem key={child.value}>
                            <SidebarMenuSubButton asChild isActive={lit.has(child.value)}>
                              <Link
                                href={child.href}
                                data-testid="nav-sub-link"
                                data-section={section.id}
                                data-value={child.value}
                              >
                                <span>{child.title}</span>
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
