import { FileText } from "lucide-react";
import Link from "next/link";

import ListEmpty from "@/components/common/ListEmpty";
import TableCard from "@/components/common/TableCard";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
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
      <ListEmpty
        icon={FileText}
        title="No bulk quotes"
        description="This customer has never asked for a bulk quote."
        reason="none"
      />
    );
  }

  return (
    // No `fill`: a Tabs panel on the profile page, in ordinary document flow.
    <TableCard
      footer={
        quoteCount > quotes.length ? (
          <div className="bg-muted/50 border-t px-3 py-2">
            <p className="text-muted-foreground text-xs">
              The latest {quotes.length} of {count(quoteCount)}.
            </p>
          </div>
        ) : null
      }
    >
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
                <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                  <Link href={`/quotes/${quote.id}`} data-testid="customer-quote-link">
                    {on(quote.createdAt)}
                  </Link>
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
    </TableCard>
  );
}
