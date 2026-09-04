import { getCustomer } from "@/lib/dal";

/**
 * Who, if anyone, the browser is signed in as.
 *
 * This exists so the site header can show an account state without the root
 * layout ever calling `cookies()`. That matters: the layout wraps every page,
 * and reading a cookie there would opt the entire catalogue - product pages,
 * the home page, everything the PWA precaches - into per-request rendering, to
 * decorate one button.
 *
 * The session token itself never appears in the response; only the profile the
 * header draws.
 */
export async function GET() {
  const customer = await getCustomer();

  return Response.json(
    { customer },
    // belt and braces: the service worker already treats /api/auth/* as
    // NetworkOnly, and this says the same thing to every cache in between
    { headers: { "cache-control": "no-store, private" } },
  );
}
