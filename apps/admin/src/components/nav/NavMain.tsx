"use client";

import type { AdminRoleCode } from "@inkhaus/shared/orders";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  activeChildren,
  ownsPath,
  visibleNav,
  type NavSection,
} from "@/components/nav/nav-config";
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
        {sections.map((section) => (
          <NavSectionItem
            key={section.id}
            section={section}
            inSection={ownsPath(section.href, pathname)}
            lit={activeChildren(section, pathname, searchParams)}
          />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function NavSectionItem({
  section,
  inSection,
  lit,
}: {
  section: NavSection;
  inSection: boolean;
  lit: ReturnType<typeof activeChildren>;
}) {
  const children = section.children ?? [];

  // Controlled, and synced to navigation: a section opens when you go into it
  // and folds when you leave, and the chevron still toggles it in between. The
  // sidebar lives in the layout and never remounts, so `defaultOpen` only ever
  // saw the first page it rendered on. Adjusted while rendering rather than in
  // an effect, which would paint the old state first.
  const [open, setOpen] = useState(inSection);
  const [wasInSection, setWasInSection] = useState(inSection);
  if (inSection !== wasInSection) {
    setWasInSection(inSection);
    setOpen(inSection);
  }

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        {/* A link, not a collapsible trigger: every section is a real
            destination, and sidebar-07's stock markup makes the parent
            unclickable. The chevron gets its own hit target below. */}
        <SidebarMenuButton asChild tooltip={section.title} isActive={inSection && lit.size === 0}>
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
                data-testid="nav-expand"
                data-section={section.id}
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
}
