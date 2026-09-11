import {
  buildQuoteWhere,
  parseUtcDay,
  patchFromInput,
  planQuoteUpdate,
  quoteOrderBy,
  startOfUtcDay,
  type QuoteState,
} from './admin-quotes.rules';

const NOW = new Date('2026-09-11T15:30:00Z');
const TODAY = new Date('2026-09-11T00:00:00Z');
const ME = 'admin-me';

const where = (filter: Parameters<typeof buildQuoteWhere>[0]) => buildQuoteWhere(filter, ME, NOW);

describe('buildQuoteWhere', () => {
  it('matches everything with no filter', () => {
    expect(where({})).toEqual({});
  });

  it('reads assignee=me as the caller', () => {
    expect(where({ assignee: 'me' })).toEqual({ AND: [{ assigneeId: ME }] });
  });

  it('reads assignee=none as unassigned', () => {
    expect(where({ assignee: 'none' })).toEqual({ AND: [{ assigneeId: null }] });
  });

  it('takes any other assignee as an admin id', () => {
    expect(where({ assignee: 'cm0staff000000000000000001' })).toEqual({
      AND: [{ assigneeId: 'cm0staff000000000000000001' }],
    });
  });

  it('finds overdue follow-ups on open quotes only, before today (UTC)', () => {
    expect(where({ followUp: 'overdue' })).toEqual({
      AND: [{ status: { in: ['NEW', 'CONTACTED'] }, followUpAt: { lt: TODAY } }],
    });
  });

  it('counts a follow-up due today as upcoming, not overdue', () => {
    expect(where({ followUp: 'upcoming' })).toEqual({
      AND: [{ status: { in: ['NEW', 'CONTACTED'] }, followUpAt: { gte: TODAY } }],
    });
  });

  it('keeps a status chip and the follow-up filter as separate clauses', () => {
    // both constrain `status`; one must not overwrite the other
    expect(where({ status: 'WON', followUp: 'overdue' }).AND).toEqual([
      { status: 'WON' },
      { status: { in: ['NEW', 'CONTACTED'] }, followUpAt: { lt: TODAY } },
    ]);
  });

  it('matches part of the email, name or company in any case', () => {
    const contains = { contains: 'athletics', mode: 'insensitive' };
    expect(where({ q: '  athletics ' })).toEqual({
      AND: [{ OR: [{ email: contains }, { name: contains }, { company: contains }] }],
    });
  });

  it('ignores a blank search', () => {
    expect(where({ q: '   ' })).toEqual({});
  });
});

describe('quoteOrderBy', () => {
  it('puts quotes with no follow-up last', () => {
    expect(quoteOrderBy('followup_asc')[0]).toEqual({ followUpAt: { sort: 'asc', nulls: 'last' } });
  });

  it('is newest first by default and always ends on a unique key', () => {
    expect(quoteOrderBy()).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    for (const sort of ['created_asc', 'followup_asc', 'quantity_desc'] as const) {
      expect(Object.keys(quoteOrderBy(sort).at(-1)!)).toEqual(['id']);
    }
  });
});

describe('days', () => {
  it('stores a follow-up day as midnight UTC', () => {
    expect(parseUtcDay('2026-09-14').toISOString()).toBe('2026-09-14T00:00:00.000Z');
    expect(startOfUtcDay(NOW)).toEqual(TODAY);
  });

  it('refuses a well-formed day that does not exist', () => {
    expect(() => parseUtcDay('2026-02-31')).toThrow(RangeError);
    expect(() => parseUtcDay('14/09/2026')).toThrow(RangeError);
  });

  it('keeps undefined (leave alone) apart from null (clear)', () => {
    expect(patchFromInput({})).toEqual({
      status: undefined,
      assigneeId: undefined,
      followUpAt: undefined,
    });
    expect(patchFromInput({ assigneeId: null, followUpAt: null })).toMatchObject({
      assigneeId: null,
      followUpAt: null,
    });
    expect(patchFromInput({ followUpAt: '2026-09-14' }).followUpAt).toEqual(parseUtcDay('2026-09-14'));
  });
});

describe('planQuoteUpdate', () => {
  const OPEN: QuoteState = {
    status: 'NEW',
    assigneeId: null,
    followUpAt: null,
    convertedOrderId: null,
  };
  const STAFF = { name: 'E2E Staff', email: 'e2e-staff@inkhaus.test' };

  it('writes and records one event per changed field, in a fixed order', () => {
    const followUpAt = parseUtcDay('2026-09-14');
    const plan = planQuoteUpdate(
      OPEN,
      { followUpAt, assigneeId: 'admin-staff', status: 'CONTACTED' },
      STAFF,
    );

    expect(plan).toEqual({
      ok: true,
      data: { status: 'CONTACTED', assigneeId: 'admin-staff', followUpAt },
      guard: { status: 'NEW', convertedOrderId: null, assigneeId: null, followUpAt: null },
      events: [
        { kind: 'STATUS', status: 'CONTACTED', note: null },
        { kind: 'ASSIGNED', status: null, note: 'E2E Staff' },
        { kind: 'FOLLOW_UP', status: null, note: '2026-09-14' },
      ],
    });
  });

  it('writes nothing and records nothing for values the quote already has', () => {
    const current: QuoteState = {
      status: 'CONTACTED',
      assigneeId: 'admin-staff',
      followUpAt: parseUtcDay('2026-09-14'),
      convertedOrderId: null,
    };
    // a different Date object for the same day is still the same day
    const plan = planQuoteUpdate(
      current,
      { status: 'CONTACTED', assigneeId: 'admin-staff', followUpAt: parseUtcDay('2026-09-14') },
      STAFF,
    );
    expect(plan).toEqual({ ok: true, data: {}, guard: {}, events: [] });
  });

  it('pins only the fields it changes, so unrelated edits do not collide', () => {
    const plan = planQuoteUpdate(OPEN, { followUpAt: parseUtcDay('2026-09-14') }, null);
    expect(plan.ok && plan.guard).toEqual({ followUpAt: null });
  });

  it('names the assignee by email when they have no name, and says so on unassigning', () => {
    const named = planQuoteUpdate(OPEN, { assigneeId: 'admin-x' }, { name: null, email: 'x@inkhaus.test' });
    expect(named.ok && named.events).toEqual([{ kind: 'ASSIGNED', status: null, note: 'x@inkhaus.test' }]);

    const cleared = planQuoteUpdate({ ...OPEN, assigneeId: 'admin-x' }, { assigneeId: null }, null);
    expect(cleared.ok && cleared.events).toEqual([{ kind: 'ASSIGNED', status: null, note: 'Unassigned' }]);
    expect(cleared.ok && cleared.data).toEqual({ assigneeId: null });
  });

  it('records a cleared follow-up with no note', () => {
    const plan = planQuoteUpdate({ ...OPEN, followUpAt: TODAY }, { followUpAt: null }, null);
    expect(plan.ok && plan.events).toEqual([{ kind: 'FOLLOW_UP', status: null, note: null }]);
  });

  it('keeps a converted quote WON', () => {
    const converted: QuoteState = { ...OPEN, status: 'WON', convertedOrderId: 'order-1' };

    expect(planQuoteUpdate(converted, { status: 'LOST' }, null)).toEqual({
      ok: false,
      message: expect.stringContaining('stays WON'),
    });
    // it can still be reassigned and chased
    expect(planQuoteUpdate(converted, { status: 'WON', assigneeId: null }, null)).toMatchObject({
      ok: true,
      events: [],
    });
    expect(planQuoteUpdate(converted, { assigneeId: 'admin-staff' }, STAFF)).toMatchObject({
      ok: true,
      events: [{ kind: 'ASSIGNED' }],
    });
  });
});
