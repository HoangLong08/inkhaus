import { QuoteEventKind, type Prisma, type QuoteStatus } from '@prisma/client';
import { canSetQuoteStatus, type QuoteSort } from '@inkhaus/shared';

/**
 * The pure half of the back-office quote workflow: which rows a list filter
 * means, how a sort orders them, and what one PATCH writes and records. No
 * Prisma client in here, so every rule is a unit test rather than a fixture.
 */

/** `assignee` takes an admin id, or one of these */
export const QUOTE_ASSIGNEE_KEYWORDS = ['me', 'none'] as const;

export const QUOTE_FOLLOW_UP_FILTERS = ['overdue', 'upcoming'] as const;

export type QuoteFollowUpFilter = (typeof QUOTE_FOLLOW_UP_FILTERS)[number];

/**
 * A follow-up is only a reminder while the lead is still open. A quote that
 * was won or lost keeps whatever date it had, but nobody needs chasing about
 * it, so it never shows as overdue.
 */
export const OPEN_QUOTE_STATUSES: QuoteStatus[] = ['NEW', 'CONTACTED'];

export type QuoteListFilter = {
  q?: string;
  status?: QuoteStatus;
  /** `me`, `none`, or an admin id */
  assignee?: string;
  followUp?: QuoteFollowUpFilter;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** midnight UTC at the start of `now`'s day - the boundary follow-ups are stored on (D8) */
export function startOfUtcDay(now: Date): Date {
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

/** `2026-09-14` -> midnight UTC that day, which is how a follow-up is stored */
export function parseUtcDay(day: string): Date {
  if (!ISO_DAY.test(day)) throw new RangeError(`Not a YYYY-MM-DD day: ${day}`);
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || !date.toISOString().startsWith(day)) {
    throw new RangeError(`Not a real day: ${day}`);
  }
  return date;
}

export const utcDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * The WHERE for the back-office quote list. Each filter is its own clause in
 * an AND, so a status chip and the follow-up filter - which both constrain
 * `status` - narrow each other instead of one overwriting the other.
 *
 * `q` matches part of the email, the name or the company, in any case: the
 * three things a person has to hand when a lead phones back.
 */
export function buildQuoteWhere(
  filter: QuoteListFilter,
  actorId: string,
  now: Date,
): Prisma.BulkQuoteWhereInput {
  const and: Prisma.BulkQuoteWhereInput[] = [];

  if (filter.status) and.push({ status: filter.status });

  const q = filter.q?.trim();
  if (q) {
    const contains = { contains: q, mode: 'insensitive' as const };
    and.push({ OR: [{ email: contains }, { name: contains }, { company: contains }] });
  }

  if (filter.assignee === 'me') and.push({ assigneeId: actorId });
  else if (filter.assignee === 'none') and.push({ assigneeId: null });
  else if (filter.assignee) and.push({ assigneeId: filter.assignee });

  if (filter.followUp) {
    // a follow-up due today is not overdue yet - it is today's work
    const today = startOfUtcDay(now);
    and.push({
      status: { in: OPEN_QUOTE_STATUSES },
      followUpAt: filter.followUp === 'overdue' ? { lt: today } : { gte: today },
    });
  }

  return and.length ? { AND: and } : {};
}

/**
 * Every order ends on `id` so a page boundary never splits two rows that tie
 * on the sort key. Quotes with no follow-up sort after the ones that have
 * one, whichever way Postgres would otherwise put nulls.
 */
export function quoteOrderBy(sort: QuoteSort = 'created_desc'): Prisma.BulkQuoteOrderByWithRelationInput[] {
  switch (sort) {
    case 'created_asc':
      return [{ createdAt: 'asc' }, { id: 'asc' }];
    case 'followup_asc':
      return [{ followUpAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'desc' }];
    case 'quantity_desc':
      return [{ quantity: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }];
    case 'created_desc':
      return [{ createdAt: 'desc' }, { id: 'desc' }];
  }
}

// ------------------------------------------------------------------ updates

/** the fields a PATCH can change, as they stand when it is read */
export type QuoteState = {
  status: QuoteStatus;
  assigneeId: string | null;
  followUpAt: Date | null;
  convertedOrderId: string | null;
};

/** `undefined` leaves a field alone; `null` clears it */
export type QuotePatch = {
  status?: QuoteStatus;
  assigneeId?: string | null;
  followUpAt?: Date | null;
};

export type QuoteEventDraft = {
  kind: QuoteEventKind;
  status: QuoteStatus | null;
  note: string | null;
};

export type QuoteUpdatePlan =
  | { ok: false; message: string }
  | {
      ok: true;
      /** only the fields that actually change */
      data: QuotePatch;
      /**
       * The values the update must still find. Each changed field is pinned to
       * what was read, so two people moving the same quote cannot both win - but
       * someone setting a follow-up while a colleague reassigns the lead is not
       * a conflict, and does not become one.
       */
      guard: Partial<QuoteState>;
      /** one per changed field, in the order the timeline should read them */
      events: QuoteEventDraft[];
    };

/** the body of `PATCH /admin/bulk-quotes/:id` after validation, as a patch */
export function patchFromInput(input: {
  status?: QuoteStatus;
  assigneeId?: string | null;
  followUpAt?: string | null;
}): QuotePatch {
  return {
    status: input.status,
    assigneeId: input.assigneeId,
    followUpAt:
      input.followUpAt === undefined ? undefined : input.followUpAt === null ? null : parseUtcDay(input.followUpAt),
  };
}

export const isEmptyPatch = (patch: QuotePatch) =>
  patch.status === undefined && patch.assigneeId === undefined && patch.followUpAt === undefined;

const sameInstant = (a: Date | null, b: Date | null) =>
  a === null || b === null ? a === b : a.getTime() === b.getTime();

/**
 * What one PATCH writes and what it records. A field sent with the value the
 * quote already has is not a change: nothing is written for it and it leaves
 * no event, so re-sending a form is harmless.
 *
 * `assignee` is the person `patch.assigneeId` resolved to - already checked to
 * be an active admin - or null when unassigning. Their name goes on the
 * ASSIGNED event so the timeline still reads right after they leave.
 */
export function planQuoteUpdate(
  current: QuoteState,
  patch: QuotePatch,
  assignee: { name: string | null; email: string } | null,
): QuoteUpdatePlan {
  const data: QuotePatch = {};
  const guard: Partial<QuoteState> = {};
  const events: QuoteEventDraft[] = [];

  if (patch.status !== undefined && patch.status !== current.status) {
    if (!canSetQuoteStatus(current, patch.status)) {
      return { ok: false, message: 'This quote has become an order, so it stays WON.' };
    }
    data.status = patch.status;
    // a conversion landing in between pins the quote to WON; this must not
    // then write LOST over it
    guard.status = current.status;
    guard.convertedOrderId = current.convertedOrderId;
    events.push({ kind: QuoteEventKind.STATUS, status: patch.status, note: null });
  }

  if (patch.assigneeId !== undefined && patch.assigneeId !== current.assigneeId) {
    data.assigneeId = patch.assigneeId;
    guard.assigneeId = current.assigneeId;
    events.push({
      kind: QuoteEventKind.ASSIGNED,
      status: null,
      note: patch.assigneeId === null ? 'Unassigned' : (assignee?.name ?? assignee?.email ?? null),
    });
  }

  if (patch.followUpAt !== undefined && !sameInstant(patch.followUpAt, current.followUpAt)) {
    data.followUpAt = patch.followUpAt;
    guard.followUpAt = current.followUpAt;
    // the day it was set for, or no note at all when it was cleared
    events.push({
      kind: QuoteEventKind.FOLLOW_UP,
      status: null,
      note: patch.followUpAt === null ? null : utcDay(patch.followUpAt),
    });
  }

  return { ok: true, data, guard, events };
}
