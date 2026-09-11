import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function QuoteNotFound() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Quote not found</h1>
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestion />
          </EmptyMedia>
          <EmptyTitle>No quote with that id</EmptyTitle>
          <EmptyDescription>The link may be mistyped, or the quote was deleted.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link href="/quotes" data-testid="quote-not-found-back">
              Back to bulk quotes
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
