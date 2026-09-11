import { REVIEW_BULK_MAX, type ReviewStatusCode } from '@inkhaus/shared';
import type { Prisma } from '@prisma/client';

/**
 * The decisions behind review moderation, kept apart from Prisma so every
 * branch is a unit test rather than a database fixture. The service reads,
 * asks these, and writes.
 */

/** what Prisma's `@default(cuid())` produces: a "c" and 24 lowercase letters or digits */
export const REVIEW_ID_PATTERN = /^c[a-z0-9]{24}$/;

export function isReviewId(value: unknown): value is string {
  return typeof value === 'string' && REVIEW_ID_PATTERN.test(value);
}

/**
 * Why a bulk selection is refused, or null when it is fine.
 *
 * Bounded because one request holds one transaction and its row locks for as
 * long as it runs - a select-all over a whole table is not a moderation
 * decision anybody made on purpose. Duplicates are refused rather than
 * collapsed: the count the caller gets back would otherwise disagree with the
 * number it sent, and a client that sends the same id twice has a bug worth
 * hearing about.
 */
export function bulkIdsError(ids: unknown): string | null {
  if (!Array.isArray(ids)) return 'ids must be a list of review ids.';
  if (ids.length === 0) return 'Select at least one review.';
  if (ids.length > REVIEW_BULK_MAX) {
    return `Moderate at most ${REVIEW_BULK_MAX} reviews at a time.`;
  }
  if (!ids.every(isReviewId)) return 'Every id must be a review id.';
  if (new Set(ids).size !== ids.length) return 'Each review may appear only once.';
  return null;
}

export type ModerationFields = {
  status: ReviewStatusCode;
  moderatedAt: Date | null;
  moderatedById: string | null;
};

/**
 * What a moderation decision writes onto the row.
 *
 * Publishing or rejecting is a decision, so it records who made it and when.
 * Sending a review back to PENDING un-makes the decision: the row goes back to
 * looking exactly like one nobody has touched, which is what the queue and the
 * "moderated by" column both mean by pending. Who reopened it is not lost - the
 * audit entry written beside the change keeps it.
 */
export function moderationFields(
  status: ReviewStatusCode,
  actorId: string,
  now: Date,
): ModerationFields {
  return status === 'PENDING'
    ? { status, moderatedAt: null, moderatedById: null }
    : { status, moderatedAt: now, moderatedById: actorId };
}

/**
 * The audit log's one line for a move to `status`, about `subject` - "the
 * review by Marisol R." for one, "3 reviews" for a batch.
 */
export function moderationSummary(status: ReviewStatusCode, subject: string): string {
  switch (status) {
    case 'PUBLISHED':
      return `Published ${subject}`;
    case 'REJECTED':
      return `Rejected ${subject}`;
    case 'PENDING':
      return `Sent ${subject} back to pending`;
  }
}

export type ModerationPlan = {
  /** asked for, but not in the database - deleted since the page was loaded */
  missing: string[];
  /** already in the target status; left alone rather than re-stamped */
  unchanged: string[];
  /** what actually moves, grouped by the status each one was read in */
  moves: { from: ReviewStatusCode; ids: string[] }[];
};

/**
 * Sorts a bulk selection against what was just read.
 *
 * Grouping by the status each row was read in is what lets the service write
 * one conditional update per group - `WHERE id IN (...) AND status = <read>` -
 * and know from the count alone whether anyone moved a row in between, the same
 * guard every other back-office write uses (decision D4).
 *
 * A review already in the target status is not touched: re-publishing would
 * rewrite who published it, and the moderation trail would say a person made a
 * decision they did not make.
 */
export function planModeration(
  ids: readonly string[],
  rows: readonly { id: string; status: ReviewStatusCode }[],
  to: ReviewStatusCode,
): ModerationPlan {
  const read = new Map(rows.map((row) => [row.id, row.status]));
  const plan: ModerationPlan = { missing: [], unchanged: [], moves: [] };
  const byFrom = new Map<ReviewStatusCode, string[]>();

  for (const id of ids) {
    const from = read.get(id);
    if (from === undefined) plan.missing.push(id);
    else if (from === to) plan.unchanged.push(id);
    else byFrom.set(from, [...(byFrom.get(from) ?? []), id]);
  }

  plan.moves = [...byFrom].map(([from, moving]) => ({ from, ids: moving }));
  return plan;
}

export type ReviewFilter = {
  status?: ReviewStatusCode;
  rating?: number;
  /** product slug */
  product?: string;
  q?: string;
};

/** the list's WHERE: exact on status, rating and product; `q` is a case-blind "contains" */
export function buildReviewWhere(filter: ReviewFilter): Prisma.ReviewWhereInput {
  const where: Prisma.ReviewWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.rating) where.rating = filter.rating;
  if (filter.product) where.product = { slug: filter.product };

  const q = filter.q?.trim();
  if (q) {
    const contains = { contains: q, mode: 'insensitive' as const };
    where.OR = [{ author: contains }, { handle: contains }, { body: contains }];
  }
  return where;
}
