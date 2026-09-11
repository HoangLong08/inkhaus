import { REVIEW_BULK_MAX } from '@inkhaus/shared';

import {
  buildReviewWhere,
  bulkIdsError,
  isReviewId,
  moderationFields,
  moderationSummary,
  planModeration,
} from './admin-reviews.rules';

/** a well-formed cuid, distinct per n */
const id = (n: number) => `c${String(n).padStart(24, '0')}`;
const ids = (count: number) => Array.from({ length: count }, (_, i) => id(i + 1));

describe('isReviewId', () => {
  it('accepts what @default(cuid()) generates', () => {
    expect(isReviewId('cmf0k3v9x0000abcd1234efgh')).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['too short', 'c123'],
    ['too long', `${id(1)}0`],
    ['not starting with c', `x${'0'.repeat(24)}`],
    ['upper case', `C${'0'.repeat(24)}`],
    ['a path', '../orders'],
    ['a number', 42],
  ])('rejects %s', (_label, value) => {
    expect(isReviewId(value)).toBe(false);
  });
});

describe('bulkIdsError', () => {
  it('accepts one id and exactly the maximum', () => {
    expect(bulkIdsError([id(1)])).toBeNull();
    expect(bulkIdsError(ids(REVIEW_BULK_MAX))).toBeNull();
  });

  it('refuses an empty selection', () => {
    expect(bulkIdsError([])).toBe('Select at least one review.');
  });

  it('refuses one over the maximum', () => {
    expect(bulkIdsError(ids(REVIEW_BULK_MAX + 1))).toBe(
      `Moderate at most ${REVIEW_BULK_MAX} reviews at a time.`,
    );
  });

  it('refuses the same review twice rather than collapsing it', () => {
    expect(bulkIdsError([id(1), id(2), id(1)])).toBe('Each review may appear only once.');
  });

  it('refuses anything that is not a review id', () => {
    expect(bulkIdsError([id(1), 'nope'])).toBe('Every id must be a review id.');
    expect(bulkIdsError([id(1), 7])).toBe('Every id must be a review id.');
  });

  it('refuses something that is not a list at all', () => {
    expect(bulkIdsError(id(1))).toBe('ids must be a list of review ids.');
    expect(bulkIdsError(undefined)).toBe('ids must be a list of review ids.');
  });

  it('checks the size before the contents, so a huge body is refused cheaply', () => {
    expect(bulkIdsError(Array(REVIEW_BULK_MAX + 1).fill('junk'))).toMatch(/at most/);
  });
});

describe('moderationFields', () => {
  const now = new Date('2026-09-11T10:00:00Z');

  it.each(['PUBLISHED', 'REJECTED'] as const)('%s records who decided and when', (status) => {
    expect(moderationFields(status, 'admin-1', now)).toEqual({
      status,
      moderatedAt: now,
      moderatedById: 'admin-1',
    });
  });

  it('PENDING clears the decision, back to an untouched review', () => {
    expect(moderationFields('PENDING', 'admin-1', now)).toEqual({
      status: 'PENDING',
      moderatedAt: null,
      moderatedById: null,
    });
  });
});

describe('moderationSummary', () => {
  it.each([
    ['PUBLISHED', 'the review by Marisol R.', 'Published the review by Marisol R.'],
    ['REJECTED', '3 reviews', 'Rejected 3 reviews'],
    ['PENDING', 'the review by Marisol R.', 'Sent the review by Marisol R. back to pending'],
  ] as const)('%s reads as a sentence', (status, subject, line) => {
    expect(moderationSummary(status, subject)).toBe(line);
  });
});

describe('planModeration', () => {
  it('groups what moves by the status it was read in', () => {
    const plan = planModeration(
      [id(1), id(2), id(3)],
      [
        { id: id(1), status: 'PENDING' },
        { id: id(2), status: 'REJECTED' },
        { id: id(3), status: 'PENDING' },
      ],
      'PUBLISHED',
    );

    expect(plan.missing).toEqual([]);
    expect(plan.unchanged).toEqual([]);
    expect(plan.moves).toEqual([
      { from: 'PENDING', ids: [id(1), id(3)] },
      { from: 'REJECTED', ids: [id(2)] },
    ]);
  });

  it('leaves a review already in the target status alone', () => {
    const plan = planModeration(
      [id(1), id(2)],
      [
        { id: id(1), status: 'PUBLISHED' },
        { id: id(2), status: 'PENDING' },
      ],
      'PUBLISHED',
    );

    expect(plan.unchanged).toEqual([id(1)]);
    expect(plan.moves).toEqual([{ from: 'PENDING', ids: [id(2)] }]);
  });

  it('reports ids that no longer exist', () => {
    const plan = planModeration([id(1), id(2)], [{ id: id(2), status: 'PENDING' }], 'REJECTED');
    expect(plan.missing).toEqual([id(1)]);
    expect(plan.moves).toEqual([{ from: 'PENDING', ids: [id(2)] }]);
  });

  it('has nothing to move when everything is already there', () => {
    const plan = planModeration([id(1)], [{ id: id(1), status: 'REJECTED' }], 'REJECTED');
    expect(plan.moves).toEqual([]);
  });
});

describe('buildReviewWhere', () => {
  it('is empty with no filters, and ignores a blank search', () => {
    expect(buildReviewWhere({})).toEqual({});
    expect(buildReviewWhere({ q: '   ' })).toEqual({});
  });

  it('filters on status, rating and product exactly', () => {
    expect(buildReviewWhere({ status: 'PENDING', rating: 4, product: 'heavyweight-tee' })).toEqual({
      status: 'PENDING',
      rating: 4,
      product: { slug: 'heavyweight-tee' },
    });
  });

  it('searches author, handle and body, in any case', () => {
    const contains = { contains: 'E2E', mode: 'insensitive' };
    expect(buildReviewWhere({ q: ' E2E ' })).toEqual({
      OR: [{ author: contains }, { handle: contains }, { body: contains }],
    });
  });
});
