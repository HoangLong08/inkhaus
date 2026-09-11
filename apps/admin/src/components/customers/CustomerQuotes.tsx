import { FileText } from "lucide-react";
import Link from "next/link";

import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CustomerQuoteRow } from "@/lib/api";
import { count, on } from "@/lib/format";

/** the customer's latest bulk-quote requests, each opening its quote */
export default function CustomerQuotes({
  quotes,
  quoteCount,
}: {
  quotes: CustomerQuoteRow[];
  quoteCount: number;
}) {
  if (quotes.length === 0) {
    return (
      <Card>
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>No bulk quotes</EmptyTitle>
            <EmptyDescription>This customer has never asked for a bulk quote.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    );
  }

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Received</TableHead>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((quote) => (
            <TableRow
              key={quote.id}
              data-testid="customer-quote-row"
              data-id={quote.id}
              data-status={quote.status}
            >
              <TableCell>
                <Button asChild variant="link" size="sm" className="h-auto p-0">
                  <Link href={`/quotes/${quote.id}`}>{on(quote.createdAt)}</Link>
                </Button>
              </TableCell>
              <TableCell className="max-w-56 truncate">
                {quote.product?.name ?? <span className="text-muted-foreground">Not chosen</span>}
              </TableCell>
              <TableCell className="text-right tabular-nums">{count(quote.quantity)}</TableCell>
              <TableCell>
                <StatusBadge status={quote.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {quoteCount > quotes.length ? (
        <CardFooter className="bg-muted/50 border-t px-4 py-2.5">
          <p className="text-muted-foreground text-xs">
            The latest {quotes.length} of {count(quoteCount)}.
          </p>
        </CardFooter>
      ) : null}
    </Card>
  );
}
