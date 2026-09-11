import { requireAdmin } from "@/lib/dal";

/**
 * Same reason as (dash): every page here is per-viewer and behind a sign-in, so
 * none of it may be served from a cached render - including after the session
 * has been revoked.
 */
export const dynamic = "force-dynamic";

/**
 * Documents meant for paper: no sidebar, no header, no query client and no
 * toaster - a packing slip is read, printed and closed. It sits under the root
 * layout (and its ThemeProvider) like /login does, and is gated exactly like
 * (dash), by asking the API whether the session is still live.
 *
 * On paper the page always prints dark ink on white, whichever theme the screen
 * was in, so the ramp colours are pinned for print here.
 */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="bg-background text-foreground print:bg-paper print:text-ink min-h-screen">
      {children}
    </div>
  );
}
