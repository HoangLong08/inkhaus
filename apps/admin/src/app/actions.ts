"use server";

import { redirect } from "next/navigation";

import { adminApi, ApiError, type OrderStatus, type QuoteStatus } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";
import { clearSession, startSession } from "@/lib/session";

export type FormState = { error?: string };

/**
 * Trades credentials for a session token and parks it in this app's own cookie.
 * The token never reaches the browser - it is set HttpOnly here and read back
 * only on the server.
 */
export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) return { error: "Email and password are both required." };

  let session: Awaited<ReturnType<typeof adminApi.login>>;
  try {
    session = await adminApi.login(email, password);
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        error:
          err.status === 0
            ? "Could not reach the INKHAUS API."
            : err.status === 429
              ? "Too many attempts. Wait a minute and try again."
              : "Invalid email or password.",
      };
    }
    throw err;
  }

  await startSession(session.token, session.expiresAt);
  // only ever bounce to a path on this origin - `next` comes from the URL
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  // best effort: kill the session server side, then drop the cookie regardless
  await adminApi.logout().catch(() => {});
  await clearSession();
  redirect("/login");
}

export async function setOrderStatus(formData: FormData) {
  await requireAdmin();
  const number = String(formData.get("number") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  const note = String(formData.get("note") ?? "").trim();

  try {
    await adminApi.setOrderStatus(number, status, note || undefined);
  } catch (err) {
    if (err instanceof ApiError) {
      redirect(`/orders/${encodeURIComponent(number)}?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }
  redirect(`/orders/${encodeURIComponent(number)}`);
}

export async function setQuoteStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as QuoteStatus;

  try {
    await adminApi.setQuoteStatus(id, status);
  } catch (err) {
    if (err instanceof ApiError) {
      redirect(`/quotes?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }
  redirect("/quotes");
}
