"use client";

import { useQuery } from "@tanstack/react-query";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { clientApi } from "@/lib/client-api";
import { queryKeys } from "@/lib/query-keys";

/**
 * The profile's `<h1>` - the customer's name, or their email when they never
 * gave one. A client leaf on the same cache entry the edit dialog writes, so a
 * renamed customer is renamed here the moment Save is pressed.
 */
export default function CustomerHeading({ id }: { id: string }) {
  const { data: customer } = useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => clientApi.customers.get(id),
  });

  // Hydrated by the page, so this is warm on the first render; the fallback
  // only keeps the page's heading if that ever stops being true.
  if (!customer) return <h1 className="text-2xl font-bold tracking-tight">Customer</h1>;

  const title = customer.name ?? customer.email;
  const subtitle = [customer.name ? customer.email : null, customer.company].filter(Boolean);

  return (
    <div className="flex items-center gap-3">
      <Avatar size="lg">
        {/* Google's `picture` claim. No referrer, so Google does not learn which
            back-office page is looking at whom. */}
        {customer.avatarUrl ? (
          <AvatarImage src={customer.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : null}
        <AvatarFallback>{title.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle.length ? (
          <p className="text-muted-foreground truncate text-sm">{subtitle.join(" · ")}</p>
        ) : null}
      </div>
    </div>
  );
}
