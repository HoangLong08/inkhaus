"use client";

import { Loader2, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

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

/** the box's value as a URL spells it: `param`, else the first alias that is set */
function readParam(search: URLSearchParams, param: string, aliases: readonly string[]) {
  return (
    search.get(param) ?? aliases.map((alias) => search.get(alias)).find((value) => value) ?? ""
  );
}

/**
 * A search box that navigates rather than fetches. The text lives in the URL,
 * the server re-renders the list from it, and back/forward work. TanStack Query
 * has nothing to do here.
 *
 * Typing commits after 300ms of quiet; Enter commits at once. Every commit drops
 * `page` - a new search is a new result set - and keeps every other param, so a
 * status filter or a sort survives it.
 *
 * The text is this component's own state, and it stays mounted while its
 * searches land: the input keeps focus, and whatever is typed while the list
 * loads is kept. It only takes the URL's word for it when the URL changes to
 * something this box did not push - back/forward, a Clear link, a nav link.
 */
export default function UrlSearchBox({
  param = "q",
  aliases = [],
  label,
  placeholder,
  testId,
  clearTestId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const fromUrl = readParam(searchParams, param, aliases);

  const [value, setValue] = useState(fromUrl);
  // The URL value last rendered, and the searches this box has pushed that the
  // URL has not shown yet, oldest first. State rather than refs: the render
  // below reads them.
  const [seen, setSeen] = useState(fromUrl);
  const [inFlight, setInFlight] = useState<readonly string[]>([]);

  if (fromUrl !== seen) {
    // Adjusting state while rendering, not in an effect: an effect would paint
    // the stale text once before correcting it.
    setSeen(fromUrl);
    const own = inFlight.indexOf(fromUrl);
    if (own >= 0) {
      // One of our own searches landing. The input already says it - or has
      // moved on since, and that newer text is the one to keep.
      setInFlight(inFlight.slice(own + 1));
    } else {
      setValue(fromUrl);
      setInFlight([]);
    }
  }

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    // A search still waiting when the page goes away must not fire afterwards
    // and navigate the user back to the list. (Aliased so the cleanup reads
    // the timer as it is at unmount, which is the point.)
    const pendingSearch = timer;
    return () => clearTimeout(pendingSearch.current);
  }, []);

  function commit(next: string) {
    clearTimeout(timer.current);
    const text = next.trim();

    // The URL as it is now, not as this render saw it: a debounced commit runs
    // 300ms later, and a filter chip clicked in between must survive it.
    const params = new URLSearchParams(window.location.search);
    const before = readParam(params, param, aliases);
    for (const alias of aliases) params.delete(alias);
    if (text) params.set(param, text);
    else params.delete(param);
    // A new filter means a new result set; staying on page 7 of the old one
    // would show an empty table and read as "the search found nothing".
    params.delete("page");

    if (text !== before) setInFlight((list) => [...list, text]);
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
