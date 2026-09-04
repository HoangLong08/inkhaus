"use client";

import Link from "next/link";
import { User } from "lucide-react";

import { useSession } from "@/lib/use-session";

/**
 * The header's account entry.
 *
 * It is a link to /account whether or not anyone is signed in, and that is the
 * point: /account redirects a stranger to /sign-in on the server, so the button
 * is correct before any JavaScript runs and there is no signed-in/signed-out
 * flicker to design around. The session lookup only ever *enriches* it, swapping
 * the generic icon for the shopper's own picture.
 */
export default function AccountButton({ className = "" }: { className?: string }) {
  const { customer } = useSession();

  return (
    <Link
      href="/account"
      data-testid="account-button"
      aria-label={customer ? `Account — ${customer.email}` : "Sign in"}
      title={customer?.email}
      className={`grid h-10 w-10 place-items-center overflow-hidden rounded-full border hairline transition hover:border-ink ${className}`}
    >
      {customer?.avatarUrl ? (
        // A plain <img>, not next/image: this is a third-party avatar at a fixed
        // 40px, so the optimizer would bill a transformation per shopper to
        // resize something already the right size.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={customer.avatarUrl}
          alt=""
          width={40}
          height={40}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : customer ? (
        <span className="text-[13px] font-bold uppercase">{customer.email[0]}</span>
      ) : (
        <User size={16} aria-hidden />
      )}
    </Link>
  );
}
