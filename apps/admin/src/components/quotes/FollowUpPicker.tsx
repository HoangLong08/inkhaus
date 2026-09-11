"use client";

import { AlarmClock, CalendarClock, Loader2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isoDay } from "@/lib/format";

import {
  dateToDay,
  dayToDate,
  followUpState,
  formatFollowUp,
  todayUtc,
} from "./quote-dates";
import { useQuoteDetail } from "./useQuoteDetail";
import { useQuoteUpdate } from "./useQuoteUpdate";

/**
 * The calendar's own day button, plus the day it stands for as data, so a
 * test can pick "today" without reading a date off the screen.
 */
function FollowUpDay(props: React.ComponentProps<typeof CalendarDayButton>) {
  return (
    <CalendarDayButton
      {...props}
      data-testid="quote-follow-up-day"
      data-day={dateToDay(props.day.date)}
      data-today={props.modifiers.today ? "true" : undefined}
    />
  );
}

/**
 * When to chase this lead next. Picking a day saves it and closes the
 * calendar; Clear removes it. Days before today are not offered - a reminder
 * in the past is just an overdue one.
 *
 * "Today" is the UTC day throughout, the calendar included, so the day that
 * reads as today here is the day the list's Overdue filter counts from.
 */
export default function FollowUpPicker({ id }: { id: string }) {
  const { data: quote } = useQuoteDetail(id);
  const [open, setOpen] = useState(false);

  const mutation = useQuoteUpdate({
    id,
    optimistic: (input) =>
      input.followUpAt === undefined
        ? {}
        : { followUpAt: input.followUpAt === null ? null : `${input.followUpAt}T00:00:00.000Z` },
    success: (next) =>
      next.followUpAt ? `Follow up on ${formatFollowUp(next.followUpAt)}` : "Follow-up cleared",
    failure: "Could not set the follow-up",
  });

  if (!quote) return null;

  const day = quote.followUpAt ? isoDay(quote.followUpAt) : null;
  const today = todayUtc();
  const state = followUpState(quote.followUpAt, quote.status, today);

  return (
    <div className="grid gap-2">
      <Label htmlFor={`quote-follow-up-${id}`}>Follow up on</Label>
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={`quote-follow-up-${id}`}
              variant="outline"
              className="flex-1 justify-start font-normal"
              disabled={mutation.isPending}
              data-testid="quote-follow-up-trigger"
              data-day={day ?? ""}
            >
              {mutation.isPending ? <Loader2 className="animate-spin" /> : <CalendarClock />}
              {day ? (
                formatFollowUp(day)
              ) : (
                <span className="text-muted-foreground">No follow-up set</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              required
              autoFocus
              today={dayToDate(today)}
              selected={day ? dayToDate(day) : undefined}
              defaultMonth={day ? dayToDate(day) : dayToDate(today)}
              disabled={{ before: dayToDate(today) }}
              components={{ DayButton: FollowUpDay }}
              onSelect={(date) => {
                setOpen(false);
                const next = dateToDay(date);
                if (next !== day) mutation.mutate({ followUpAt: next });
              }}
            />
          </PopoverContent>
        </Popover>

        {day ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={mutation.isPending}
            data-testid="quote-follow-up-clear"
            onClick={() => mutation.mutate({ followUpAt: null })}
          >
            <X />
            Clear
          </Button>
        ) : null}
      </div>

      {/* spelled out beside the colour, never the colour alone */}
      {state === "overdue" ? (
        <p className="text-destructive flex items-center gap-1.5 text-xs font-medium">
          <AlarmClock className="size-4" />
          Overdue - this lead was due a call.
        </p>
      ) : state === "today" ? (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <AlarmClock className="size-4" />
          Due today.
        </p>
      ) : null}
    </div>
  );
}
