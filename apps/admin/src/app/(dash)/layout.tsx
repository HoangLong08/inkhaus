import Link from "next/link";

import { logout } from "@/app/actions";
import { requireAdmin } from "@/lib/dal";

/**
 * Every page under this layout is per-viewer and permission-checked, so none of
 * it may ever be served from a cached render. Without this, requesting the same
 * URL twice returned the first render - including after the session had been
 * revoked - because the auth check never ran the second time. Applies to the
 * whole segment subtree.
 */
export const dynamic = "force-dynamic";

/**
 * The real gate for everything in this route group. `proxy.ts` only checked that
 * a cookie exists; this asks the API whether it is still a live session, and
 * redirects to /login if not.
 */
export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/" className="text-sm font-black uppercase tracking-tight">
            INKHAUS<span className="ml-1.5 font-medium text-ink-3">back office</span>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            <NavLink href="/orders">Orders</NavLink>
            <NavLink href="/quotes">Bulk quotes</NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-ink-3 sm:inline">
              {user.name ?? user.email} · {user.role.toLowerCase()}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold transition hover:bg-paper-2"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-2.5 py-1.5 font-medium text-ink-2 transition hover:bg-paper-2 hover:text-ink"
    >
      {children}
    </Link>
  );
}
