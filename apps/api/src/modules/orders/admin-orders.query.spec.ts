import { BadRequestException } from '@nestjs/common';
import { ORDER_SORTS } from '@inkhaus/shared';

import { buildOrderWhere, dayWindow, describeFilter, orderByFor } from './admin-orders.query';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('buildOrderWhere', () => {
  it('filters on status alone', () => {
    expect(buildOrderWhere({ status: 'PAID' })).toEqual({ status: 'PAID' });
  });

  it('filters on one customer', () => {
    expect(buildOrderWhere({ customerId: 'ckzcustomer000000000000001' })).toEqual({
      customerId: 'ckzcustomer000000000000001',
    });
  });

  it('adds nothing for an empty filter or a blank search', () => {
    expect(buildOrderWhere({})).toEqual({});
    expect(buildOrderWhere({ q: '   ' })).toEqual({});
  });

  it('matches part of a number, email, name or ship-to name, in any case', () => {
    const contains = { contains: 'e2e-cust', mode: 'insensitive' };
    expect(buildOrderWhere({ q: ' e2e-cust ', status: 'PAID' })).toEqual({
      status: 'PAID',
      OR: [
        { number: contains },
        { customer: { email: contains } },
        { customer: { name: contains } },
        { shipName: contains },
      ],
    });
  });

  it('matches a partial email - the half-typed address that used to 400', () => {
    expect(buildOrderWhere({ q: 'e2e-customer@inkh' }).OR).toContainEqual({
      customer: { email: { contains: 'e2e-customer@inkh', mode: 'insensitive' } },
    });
  });

  it('matches a customer or ship-to name', () => {
    const OR = buildOrderWhere({ q: 'Ridgeline' }).OR;
    expect(OR).toContainEqual({ customer: { name: { contains: 'Ridgeline', mode: 'insensitive' } } });
    expect(OR).toContainEqual({ shipName: { contains: 'Ridgeline', mode: 'insensitive' } });
  });

  it.each([
    ['900002', 'INK-900002'],
    ['ink-900002', 'INK-900002'],
    ['INK900002', 'INK-900002'],
    ['ink-12', 'INK-000012'],
    ['12', 'INK-000012'],
  ])('reads %s as order %s', (q, number) => {
    expect(buildOrderWhere({ q }).OR).toContainEqual({ number });
  });

  it('still finds a number fragment by "contains"', () => {
    // "0000" is too short to be anyone's order, but it is in every early one
    expect(buildOrderWhere({ q: '9000' }).OR).toContainEqual({
      number: { contains: '9000', mode: 'insensitive' },
    });
  });

  it('does not read a name as an order number', () => {
    expect(buildOrderWhere({ q: 'inkwell' }).OR).toHaveLength(4);
  });

  it('counts a draft on the day it was created, a placed order on the day it was placed', () => {
    const window = { gte: day('2026-08-15'), lt: day('2026-08-16') };
    expect(buildOrderWhere({ from: '2026-08-15', to: '2026-08-15' })).toEqual({
      AND: [{ OR: [{ placedAt: window }, { placedAt: null, createdAt: window }] }],
    });
  });

  it('keeps the date test apart from the search, which owns the top-level OR', () => {
    const where = buildOrderWhere({ q: '900002', status: 'DELIVERED', from: '2026-08-01', to: '2026-08-31' });
    expect(where.status).toBe('DELIVERED');
    expect(where.OR).toContainEqual({ number: 'INK-900002' });
    expect(where.AND).toEqual([
      {
        OR: [
          { placedAt: { gte: day('2026-08-01'), lt: day('2026-09-01') } },
          { placedAt: null, createdAt: { gte: day('2026-08-01'), lt: day('2026-09-01') } },
        ],
      },
    ]);
  });
});

describe('dayWindow', () => {
  it('is no filter at all without either end', () => {
    expect(dayWindow()).toBeNull();
  });

  it('turns inclusive UTC days into a half-open interval', () => {
    expect(dayWindow('2026-08-01', '2026-08-03')).toEqual({
      gte: day('2026-08-01'),
      lt: day('2026-08-04'),
    });
  });

  it('leaves a range open on the side that was not given', () => {
    expect(dayWindow('2026-08-01')).toEqual({ gte: day('2026-08-01') });
    expect(dayWindow(undefined, '2026-08-31')).toEqual({ lt: day('2026-09-01') });
  });

  it('crosses a month and a leap day', () => {
    expect(dayWindow('2028-02-28', '2028-02-29')).toEqual({
      gte: day('2028-02-28'),
      lt: day('2028-03-01'),
    });
  });

  it('has no cap on the span - a paged list builds no day-by-day series', () => {
    expect(dayWindow('2020-01-01', '2026-12-31')).toEqual({
      gte: day('2020-01-01'),
      lt: day('2027-01-01'),
    });
  });

  it('refuses an inverted range', () => {
    expect(() => dayWindow('2026-08-03', '2026-08-01')).toThrow(BadRequestException);
  });

  it.each([
    ['from', '2026-02-30', undefined],
    ['to', undefined, '2026-13-01'],
    ['from', '11/09/2026', undefined],
  ])('refuses a %s that is not a real day', (name, from, to) => {
    expect(() => dayWindow(from, to)).toThrow(`"${name}" must be a date as YYYY-MM-DD`);
  });
});

describe('orderByFor', () => {
  it('sorts by placed day with drafts last, either way round', () => {
    expect(orderByFor('placed_desc')).toEqual([
      { placedAt: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'desc' },
      { seq: 'desc' },
    ]);
    expect(orderByFor('placed_asc')).toEqual([
      { placedAt: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'asc' },
      { seq: 'asc' },
    ]);
  });

  it('sorts by total', () => {
    expect(orderByFor('total_desc')).toEqual([{ total: 'desc' }, { seq: 'desc' }]);
    expect(orderByFor('total_asc')).toEqual([{ total: 'asc' }, { seq: 'asc' }]);
  });

  it('sorts by number through the counter, not the string', () => {
    expect(orderByFor('number_desc')).toEqual([{ seq: 'desc' }]);
    expect(orderByFor('number_asc')).toEqual([{ seq: 'asc' }]);
  });

  it.each(ORDER_SORTS)('ends %s on the unique seq, so ties page stably', (sort) => {
    const last = orderByFor(sort).at(-1);
    expect(last).toHaveProperty('seq');
  });
});

describe('describeFilter', () => {
  it('says "none" for no filter', () => {
    expect(describeFilter({})).toBe('none');
  });

  it('lists what was set, quoting the search', () => {
    expect(
      describeFilter({ q: 'a "b"', status: 'PAID', from: '2026-08-01', to: '2026-08-31', customerId: 'cx' }),
    ).toBe('q="a \\"b\\"", status=PAID, from=2026-08-01, to=2026-08-31, customer=cx');
  });
});
