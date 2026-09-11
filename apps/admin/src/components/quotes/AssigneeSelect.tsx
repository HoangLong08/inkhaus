"use client";

import { Loader2 } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StaffDirectoryEntry } from "@/lib/api";

import { useQuoteDetail } from "./useQuoteDetail";
import { useQuoteUpdate } from "./useQuoteUpdate";

/** a Radix Select item cannot have an empty value, so "nobody" needs a name */
const NONE = "none";

type Person = { id: string; name: string | null; email: string };

const who = (person: Omit<Person, "id">) => person.name ?? person.email;

/**
 * Who is working this lead. The options are the active staff directory, which
 * the page reads on the server and passes down - it is the same list for every
 * quote, so there is nothing for the client to fetch. Picking one saves it.
 */
export default function AssigneeSelect({
  id,
  directory,
  meId,
}: {
  id: string;
  directory: StaffDirectoryEntry[];
  /** marks your own entry, so "assign to me" is one click to find */
  meId: string;
}) {
  const { data: quote } = useQuoteDetail(id);

  const mutation = useQuoteUpdate({
    id,
    optimistic: (input) => {
      if (input.assigneeId === undefined) return {};
      const person = directory.find((entry) => entry.id === input.assigneeId);
      return {
        assignee: person ? { id: person.id, name: person.name, email: person.email } : null,
      };
    },
    success: (next) => (next.assignee ? `Assigned to ${who(next.assignee)}` : "Unassigned"),
    failure: "Could not reassign the quote",
  });

  if (!quote) return null;

  // Someone deactivated since keeps their name on the quote until it is
  // reassigned, so they stay in the list - a Select cannot show a value it
  // has no option for.
  const current = quote.assignee;
  const options: Person[] = directory.map(({ id: personId, name, email }) => ({
    id: personId,
    name,
    email,
  }));
  if (current && !options.some((person) => person.id === current.id)) options.push(current);
  const value = current?.id ?? NONE;

  return (
    <div className="grid gap-2">
      <Label htmlFor={`quote-assignee-${id}`}>Assignee</Label>
      <div className="flex items-center gap-2">
        <Select
          value={value}
          disabled={mutation.isPending}
          onValueChange={(next) => mutation.mutate({ assigneeId: next === NONE ? null : next })}
        >
          <SelectTrigger
            id={`quote-assignee-${id}`}
            className="w-full"
            data-testid="quote-assignee-select"
            data-assignee={value}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE} data-testid="quote-assignee-option" data-id={NONE}>
              Unassigned
            </SelectItem>
            <SelectSeparator />
            {options.map((person) => (
              <SelectItem
                key={person.id}
                value={person.id}
                data-testid="quote-assignee-option"
                data-id={person.id}
                data-self={person.id === meId ? "true" : undefined}
              >
                {who(person)}
                {person.id === meId ? <span className="text-muted-foreground">(you)</span> : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {mutation.isPending ? (
          <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
        ) : null}
      </div>
    </div>
  );
}
