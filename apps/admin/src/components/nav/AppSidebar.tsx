import { BrandHeader } from "@/components/nav/BrandHeader";
import { NavMain } from "@/components/nav/NavMain";
import { NavUser } from "@/components/nav/NavUser";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { AdminUser } from "@/lib/api";

/**
 * `user` arrives from the (dash) layout, which already resolved it through
 * requireAdmin(). It is a plain object, so handing it to the client components
 * below serialises fine, and the role it carries is not a secret - the nav uses
 * it only to hide what the BFF and the API would refuse anyway.
 */
export function AppSidebar({ user }: { user: AdminUser }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <BrandHeader />
      </SidebarHeader>
      <SidebarContent>
        <NavMain role={user.role} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
