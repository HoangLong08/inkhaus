import { cookies } from "next/headers";

import { AppSidebar } from "@/components/nav/AppSidebar";
import { DashBreadcrumb } from "@/components/nav/DashBreadcrumb";
import { ThemeToggle } from "@/components/nav/ThemeToggle";
import { Providers } from "@/components/providers/Providers";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireAdmin } from "@/lib/dal";

/**
 * Every page under this layout is per-viewer and permission-checked, so none of
 * it may ever be served from a cached render. Without this, requesting the same
 * URL twice returned the first render - including after the session had been
 * revoked - because the auth check never ran the second time. Applies to the
 * whole segment subtree.
 *
 * It is also what makes NavMain's useSearchParams() safe: nothing in this
 * subtree is prerendered, so that hook needs no Suspense boundary of its own.
 */
export const dynamic = "force-dynamic";

/**
 * The real gate for everything in this route group. `proxy.ts` only checked that
 * a cookie exists; this asks the API whether it is still a live session, and
 * redirects to /login if not.
 *
 * Keep requireAdmin() as the only data this layout awaits. A layout that reads
 * runtime data is not covered by a sibling loading.tsx - navigation blocks on it
 * - and requireAdmin is React-cached, so the page below pays nothing for it.
 * Fetching a list here would cost every page in the group its loading skeleton.
 */
export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const [user, cookieStore] = await Promise.all([requireAdmin(), cookies()]);

  // Read `!== "false"`, not `=== "true"`. shadcn's own example does the latter,
  // which leaves a first-time visitor with the nav collapsed; a back office
  // should show its navigation until told otherwise. Resolving this server side
  // is also what stops the sidebar flashing open and snapping shut on load.
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <Providers>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar user={user} />
        <SidebarInset>
          {/* h-(--app-header-h) rather than h-14, same 3.5rem: a list page sizes
              itself `calc(100svh - var(--app-header-h))`, and the two must not be
              able to drift. The number lives in globals.css. */}
          <header className="bg-background/90 h-(--app-header-h) sticky top-0 z-10 flex shrink-0 items-center gap-2 border-b backdrop-blur">
            <div className="flex w-full items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" data-testid="sidebar-toggle" />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <DashBreadcrumb />
              <ThemeToggle className="ml-auto" />
            </div>
          </header>

          <main className="flex-1 px-4 py-8 md:px-8">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </Providers>
  );
}
