"use client";

import { Loader2, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  /** the URL key the text is written to */
  param?: string;
  /**
   * Older names for the same key. Read when `param` is absent, and dropped on
   * every commit - otherwise clearing the box would leave the old key filtering
   * the list with nothing on screen to say so.
   */
  aliases?: readonly string[];
  /** read by screen readers; the visible cue is the icon and the placeholder */
  label: string;
  placeholder?: string;
  testId: string;
  clearTestId: string;
};

/**
 * A search box that navigates rather than fetches. The text lives in the URL,
 * the server re-renders the list from it, and back/forward work. TanStack Query
 * has nothing to do here.
 *
 * Typing commits after 300ms of quiet; Enter commits at once. Every commit drops
 * `page` - a new search is a new result set - and keeps every other param, so a
 * status filter or a sort survives it.
 */
export default function UrlSearchBox({ param = "q", aliases = [], ...rest }: Props) {
  const searchParams = useSearchParams();
  const fromUrl =
    searchParams.get(param) ??
    aliases.map((alias) => searchParams.get(alias)).find((value) => value) ??
    "";

  // Keyed on the URL value, so any navigation that changes the filter - a status
  // chip, the back button, the Clear button - remounts this with the right
  // starting text. The alternative, mirroring the URL into state from an effect,
  // renders once with the stale value and then again with the fresh one.
  return <SearchBox key={fromUrl} initial={fromUrl} param={param} aliases={aliases} {...rest} />;
}

function SearchBox({
  initial,
  param,
  aliases,
  label,
  placeholder,
  testId,
  clearTestId,
}: Required<Pick<Props, "param" | "aliases">> & Omit<Props, "param" | "aliases"> & {
  initial: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function commit(next: string) {
    const params = new URLSearchParams(searchParams);
    for (const alias of aliases) params.delete(alias);
    if (next.trim()) params.set(param, next.trim());
    else params.delete(param);
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
      <Label htmlFor={testId} className="sr-only">
        {label}
      </Label>
      <div className="relative w-full max-w-sm">
        <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
        <Input
          id={testId}
          type="search"
          value={value}
          // the URL schema drops anything longer, so do not let it be typed
          maxLength={100}
          placeholder={placeholder}
          data-testid={testId}
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
          data-testid={clearTestId}
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
