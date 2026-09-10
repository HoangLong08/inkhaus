"use client";

import { Loader2, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The only interactive part of the orders list, and deliberately not a query:
 * this navigates. The filter lives in the URL, the server re-renders the table
 * from it, and back/forward work. TanStack Query has nothing to do here.
 */
export default function OrdersToolbar() {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("email") ?? "";

  // Keyed on the URL value, so any navigation that changes the filter - a status
  // chip, the back button, the Clear button - remounts this with the right
  // starting text. The alternative, mirroring the URL into state from an effect,
  // renders once with the stale value and then again with the fresh one.
  return <SearchBox key={fromUrl} initial={fromUrl} />;
}

function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function commit(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next.trim()) params.set("email", next.trim());
    else params.delete("email");
    // A new filter means a new result set; staying on page 7 of the old one
    // would show an empty table and read as "the search found nothing".
    params.delete("page");

    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function onChange(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(next), 300);
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="orders-search" className="sr-only">
        Filter by customer email
      </Label>
      <div className="relative w-full max-w-sm">
        <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
        <Input
          id="orders-search"
          type="search"
          value={value}
          placeholder="Filter by customer email…"
          data-testid="orders-search"
          className="pl-8"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            clearTimeout(timer.current);
            commit(value);
          }}
        />
        {pending ? (
          <Loader2 className="text-muted-foreground absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin" />
        ) : null}
      </div>

      {value ? (
        <Button
          variant="ghost"
          size="sm"
          data-testid="orders-search-clear"
          onClick={() => {
            clearTimeout(timer.current);
            setValue("");
            commit("");
          }}
        >
          <X />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
