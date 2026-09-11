import { Prisma } from '@prisma/client';

import {
  buildCustomerWhere,
  customerEditDiff,
  customerOrderBy,
  foldOrderGroups,
  normaliseText,
  type OrderGroup,
} from './admin-customers.query';

describe('buildCustomerWhere', () => {
  it('is empty with no filter and with a blank search', () => {
    expect(buildCustomerWhere({})).toEqual({});
    expect(buildCustomerWhere({ q: '   ' })).toEqual({});
  });

  it('matches part of an email, name, company or phone, in any case', () => {
    const contains = { contains: 'ridge', mode: 'insensitive' };
    expect(buildCustomerWhere({ q: ' ridge ' })).toEqual({
      OR: [{ email: contains }, { name: contains }, { company: contains }, { phone: contains }],
    });
  });

  it('reads "with orders" as at least one order past DRAFT', () => {
    expect(buildCustomerWhere({ hasOrders: 'yes' })).toEqual({
      orders: { some: { status: { not: 'DRAFT' } } },
    });
  });

  it('reads "no orders" as none past DRAFT, so a customer with only a draft still counts', () => {
    expect(buildCustomerWhere({ hasOrders: 'no' })).toEqual({
      orders: { none: { status: { not: 'DRAFT' } } },
    });
  });

  it('combines the search with the order filter', () => {
    const where = buildCustomerWhere({ q: 'e2e', hasOrders: 'yes' });
    expect(where.OR).toHaveLength(4);
    expect(where.orders).toEqual({ some: { status: { not: 'DRAFT' } } });
  });
});

describe('customerOrderBy', () => {
  it.each([
    ['created_desc', [{ createdAt: 'desc' }, { id: 'desc' }]],
    ['created_asc', [{ createdAt: 'asc' }, { id: 'asc' }]],
    ['name_asc', [{ name: { sort: 'asc', nulls: 'last' } }, { email: 'asc' }]],
    ['orders_desc', [{ orders: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }]],
    ['login_desc', [{ lastLoginAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'desc' }]],
  ] as const)('sorts %s', (sort, orderBy) => {
    expect(customerOrderBy(sort)).toEqual(orderBy);
  });

  it('always ends on a unique column, so pages never overlap', () => {
    for (const sort of ['created_desc', 'created_asc', 'name_asc', 'orders_desc', 'login_desc'] as const) {
      const last = customerOrderBy(sort).at(-1)!;
      expect(Object.keys(last)[0]).toMatch(/^(id|email)$/);
    }
  });
});

describe('foldOrderGroups', () => {
  const day = (d: string) => new Date(`${d}T12:00:00Z`);
  const group = (
    customerId: string,
    status: OrderGroup['status'],
    count: number,
    total: string,
    first: string,
    last: string,
  ): OrderGroup => ({
    customerId,
    status,
    _count: { _all: count },
    _sum: { total: new Prisma.Decimal(total) },
    _min: { placedAt: day(first) },
    _max: { placedAt: day(last) },
  });

  it('adds up revenue statuses only, and counts every placed order', () => {
    // the e2e customer: 120.00 PAID, 374.40 IN_PRODUCTION, 238.40 DELIVERED
    const totals = foldOrderGroups([
      group('c1', 'PAID', 1, '120.00', '2026-09-09', '2026-09-09'),
      group('c1', 'IN_PRODUCTION', 1, '374.40', '2026-09-06', '2026-09-06'),
      group('c1', 'DELIVERED', 1, '238.40', '2026-08-15', '2026-08-15'),
      group('c1', 'CANCELLED', 2, '99.99', '2026-07-01', '2026-07-02'),
    ]);

    expect(totals.get('c1')).toEqual({
      orderCount: 5,
      lifetimeValue: 732.8,
      averageOrder: 244.27,
      refunded: 0,
      firstOrderAt: day('2026-07-01'),
      lastOrderAt: day('2026-09-09'),
    });
  });

  it('keeps refunds out of the lifetime value and reports them apart', () => {
    const totals = foldOrderGroups([
      group('c1', 'SHIPPED', 2, '50.10', '2026-01-01', '2026-02-01'),
      group('c1', 'REFUNDED', 1, '20.20', '2026-03-01', '2026-03-01'),
    ]);

    const c1 = totals.get('c1')!;
    expect(c1.lifetimeValue).toBe(50.1);
    expect(c1.averageOrder).toBe(25.05);
    expect(c1.refunded).toBe(20.2);
    expect(c1.orderCount).toBe(3);
  });

  it('sums in whole cents, so a long list of prices does not drift', () => {
    const groups = Array.from({ length: 10 }, (_, i) =>
      group('c1', i % 2 ? 'PAID' : 'DELIVERED', 1, '0.10', '2026-01-01', '2026-01-01'),
    );
    expect(foldOrderGroups(groups).get('c1')!.lifetimeValue).toBe(1);
  });

  it('ignores DRAFT groups even if the query let one through', () => {
    const totals = foldOrderGroups([
      { ...group('c1', 'DRAFT', 3, '500.00', '2026-01-01', '2026-01-01'), _min: { placedAt: null }, _max: { placedAt: null } },
    ]);
    expect(totals.has('c1')).toBe(false);
  });

  it('keeps customers apart and leaves the average at zero with no revenue', () => {
    const totals = foldOrderGroups([
      group('c1', 'PAID', 1, '10.00', '2026-01-01', '2026-01-01'),
      group('c2', 'CANCELLED', 1, '10.00', '2026-01-02', '2026-01-02'),
    ]);
    expect(totals.get('c1')!.lifetimeValue).toBe(10);
    expect(totals.get('c2')).toMatchObject({ orderCount: 1, lifetimeValue: 0, averageOrder: 0 });
  });

  it('treats a null sum as nothing', () => {
    const totals = foldOrderGroups([{ ...group('c1', 'PAID', 1, '0', '2026-01-01', '2026-01-01'), _sum: { total: null } }]);
    expect(totals.get('c1')!.lifetimeValue).toBe(0);
  });
});

describe('customer edits', () => {
  const current = { name: 'E2E Customer', phone: '555-0100', company: 'Ridgeline FC', adminNote: null };

  it('trims text and stores a blank as null', () => {
    expect(normaliseText('  Ridgeline  ')).toBe('Ridgeline');
    expect(normaliseText('   ')).toBeNull();
    expect(normaliseText(null)).toBeNull();
    expect(normaliseText(42)).toBe(42);
  });

  it('records only the fields that change, as they were and as they are', () => {
    expect(
      customerEditDiff(current, { phone: '555-0199', company: 'Ridgeline FC', adminNote: ' Pays late ' }),
    ).toEqual({
      before: { phone: '555-0100', adminNote: null },
      after: { phone: '555-0199', adminNote: 'Pays late' },
    });
  });

  it('clears a field sent blank or null', () => {
    expect(customerEditDiff(current, { company: '' })).toEqual({
      before: { company: 'Ridgeline FC' },
      after: { company: null },
    });
    expect(customerEditDiff(current, { name: null })?.after).toEqual({ name: null });
  });

  it('is null when nothing changes, so a no-op save writes nothing', () => {
    expect(customerEditDiff(current, {})).toBeNull();
    expect(customerEditDiff(current, { name: ' E2E Customer ', adminNote: '' })).toBeNull();
  });
});
