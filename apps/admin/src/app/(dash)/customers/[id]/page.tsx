import { can } from "@inkhaus/shared/admin";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import CustomerDesigns, { CustomerDesignsSkeleton } from "@/components/customers/CustomerDesigns";
import CustomerHeading from "@/components/customers/CustomerHeading";
import CustomerOrders from "@/components/customers/CustomerOrders";
import CustomerProfileCard from "@/components/customers/CustomerProfileCard";
import CustomerQuotes from "@/components/customers/CustomerQuotes";
import CustomerStats from "@/components/customers/CustomerStats";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminApi, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/dal";
import { count } from "@/lib/format";
import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { customerIdSchema } from "@/lib/schemas/params";

// Not the customer's name or email: a tab title ends up in browser history and
// on a shared screen, and the breadcrumb says "Customer" for the same reason.
export const metadata = { title: "Customer — INKHAUS Back Office" };

/**
 * One customer: what they are worth, what they have ordered and asked for, and
 * what staff know about them.
 *
 * One server fetch, dehydrated into the client cache for the two leaves an edit
 * changes - the heading and the profile card. Everything else is server
 * rendered from that same response, because nothing else can change from here.
 */
export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id: raw }, user] = await Promise.all([
    params,
    // cached by the DAL, so this costs nothing beyond the layout's own call
    requireAdmin(),
  ]);

  const parsed = customerIdSchema.safeParse(raw);
  if (!parsed.success) notFound();
  const id = parsed.data;

  const queryClient = getQueryClient();

  // fetchQuery, not prefetchQuery: the server-rendered parts need the value too
  const customer = await queryClient
    .fetchQuery({
      queryKey: queryKeys.customers.detail(id),
      queryFn: () => adminApi.customers.get(id),
    })
    .catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 404) notFound();
      throw err;
    });

  // Artwork, including designs never ordered, is owner-only. Without the
  // capability the tab is not rendered at all - no trigger, no panel, no
  // request - rather than shown disabled.
  const showDesigns = can(user.role, "designs.view");

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <div>
          <Button asChild variant="link" size="sm" className="h-auto p-0">
            <Link href="/customers">
              <ArrowLeft />
              Customers
            </Link>
          </Button>
          <div className="mt-2">
            <CustomerHeading id={id} />
          </div>
        </div>

        <CustomerStats customer={customer} />

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Tabs defaultValue="orders" className="min-w-0">
            <TabsList>
              <TabsTrigger value="orders" data-testid="customer-tab" data-tab="orders">
                Orders <TabCount value={customer.orderCount} />
              </TabsTrigger>
              <TabsTrigger value="quotes" data-testid="customer-tab" data-tab="quotes">
                Quotes <TabCount value={customer.stats.quoteCount} />
              </TabsTrigger>
              {showDesigns ? (
                <TabsTrigger value="designs" data-testid="customer-tab" data-tab="designs">
                  Designs <TabCount value={customer.stats.designCount} />
                </TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="orders">
              <CustomerOrders
                orders={customer.recentOrders}
                email={customer.email}
                orderCount={customer.orderCount}
              />
            </TabsContent>
            <TabsContent value="quotes">
              <CustomerQuotes quotes={customer.quotes} quoteCount={customer.stats.quoteCount} />
            </TabsContent>
            {showDesigns ? (
              <TabsContent value="designs">
                <Suspense fallback={<CustomerDesignsSkeleton />}>
                  <CustomerDesigns email={customer.email} />
                </Suspense>
              </TabsContent>
            ) : null}
          </Tabs>

          <CustomerProfileCard id={id} canEdit={can(user.role, "customers.edit")} />
        </div>
      </div>
    </HydrationBoundary>
  );
}

function TabCount({ value }: { value: number }) {
  return <span className="text-muted-foreground tabular-nums">{count(value)}</span>;
}
