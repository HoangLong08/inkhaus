"use client";

import { CalendarDays, Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { DateRange } from "react-day-picker";
import { cn } from "cn";

import { TOOLBAR_BUTTON } from "@/components/common/toolbar-styles";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isoDay } from "@/lib/format";

/** the ranges an operator asks for without thinking, ending today (UTC) */
const PRESETS = [7, 30, 90] as const;

const short = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * The calendar draws in local time; the URL speaks UTC days (decision D8). A day
 * is a label, not an instant, so the conversion is by components - `2026-08-15`
 * is the local midnight the calendar draws August 15th at - never through
 * `toISOString`, which would shift it a day west of Greenwich.
 */
function toDate(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toDay(date: Date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

function describe(from?: string, to?: string, empty = "Any date") {
  if (from && to) return from === to ? short.format(toDate(from)) : `${short.format(toDate(from))} – ${short.format(toDate(to))}`;
  if (from) return `From ${short.format(toDate(from))}`;
  if (to) return `Until ${short.format(toDate(to))}`;
  return empty;
}

type Props = {
  /** test id prefix: `<prefix>-date-trigger`, `-apply`, `-clear`, `-preset` */
  prefix: string;
  /** the page's parsed `from` / `to`, `YYYY-MM-DD` */
  from?: string;
  to?: string;
  /** trigger text when no range is set */
  placeholder?: string;
  fromParam?: string;
  toParam?: string;
};

/**
 * A date range that lives in the URL, as `from` and `to` - both inclusive, both
 * UTC days. Like the search box it navigates rather than fetches: the server
 * re-renders the list, and a range is a link you can send someone.
 *
 * Apply writes the range picked in the calendar (a single day is from = to); a
 * preset applies at once; Clear removes both. Every change drops `page` and
 * keeps the rest of the query string.
 */
export default function DateRangePicker({
  prefix,
  from,
  to,
  placeholder = "Any date",
  fromParam = "from",
  toParam = "to",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  function commit(next: { from?: string; to?: string }) {
    const params = new URLSearchParams(searchParams);
    if (next.from) params.set(fromParam, next.from);
    else params.delete(fromParam);
    if (next.to) params.set(toParam, next.to);
    else params.delete(toParam);
    params.delete("page");

    const qs = params.toString();
    setOpen(false);
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function preset(days: number) {
    // today by the UTC calendar, as the local date the picker would draw it at
    const today = toDate(isoDay(new Date()));
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    commit({ from: toDay(start), to: toDay(today) });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // start every visit from what the URL says, not from an abandoned pick
        if (next) setRange(from ? { from: toDate(from), to: to ? toDate(to) : undefined } : undefined);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid={`${prefix}-date-trigger`}
          data-from={from ?? ""}
          data-to={to ?? ""}
          className={cn(TOOLBAR_BUTTON, "font-normal")}
        >
          {pending ? <Loader2 className="animate-spin" /> : <CalendarDays />}
          {describe(from, to, placeholder)}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex flex-wrap gap-1.5 border-b p-3">
          {PRESETS.map((days) => (
            <Button
              key={days}
              variant="secondary"
              size="sm"
              className="h-7 text-xs"
              data-testid={`${prefix}-date-preset`}
              data-days={days}
              onClick={() => preset(days)}
            >
              Last {days} days
            </Button>
          ))}
        </div>

        <Calendar
          mode="range"
          numberOfMonths={2}
          defaultMonth={range?.from}
          selected={range}
          onSelect={setRange}
        />

        <div className="flex justify-end gap-2 border-t p-3">
          <Button
            variant="ghost"
            size="sm"
            data-testid={`${prefix}-date-clear`}
            disabled={!from && !to && !range?.from}
            onClick={() => commit({})}
          >
            Clear
          </Button>
          <Button
            size="sm"
            data-testid={`${prefix}-date-apply`}
            disabled={!range?.from}
            onClick={() => {
              if (!range?.from) return;
              const start = toDay(range.from);
              commit({ from: start, to: range.to ? toDay(range.to) : start });
            }}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
