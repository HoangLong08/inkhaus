"use server";

import { canSetStatus } from "@inkhaus/shared";
import { redirect } from "next/navigation";

import { adminApi, ApiError, type OrderStatus, type QuoteStatus } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";
import { clearSession } from "@/lib/session";

// Signing in is not an action: it is a redirect out to Google and back, which
// only a Route Handler can do. See src/app/api/auth/google/.

export async function logout() {
  // best effort: kill the session server side, then drop the cookie regardless
  await adminApi.logout().catch(() => {});
  await clearSession();
  redirect("/login");
}

export async function setOrderStatus(formData: FormData) {
  const user = await requireAdmin();
  const number = String(formData.get("number") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  const note = String(formData.get("note") ?? "").trim();

  // The dropdown already hides these for staff, so reaching this means the form
  // was hand-made. Refuse before the round trip; the API refuses too.
  if (!canSetStatus(user.role, status)) {
    redirect(
      `/orders/${encodeURIComponent(number)}?error=${encodeURIComponent(
        `Only an owner can move an order to ${status}`,
      )}`,
    );
  }

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
