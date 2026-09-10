import { buildOrderWhere } from './admin-orders.query';

describe('buildOrderWhere', () => {
  it('filters on status alone', () => {
    expect(buildOrderWhere({ status: 'PAID' })).toEqual({ status: 'PAID' });
  });

  it('ignores a blank search', () => {
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

  it.each([
    ['900002', 'INK-900002'],
    ['ink-900002', 'INK-900002'],
    ['INK900002', 'INK-900002'],
    ['ink-12', 'INK-000012'],
    ['12', 'INK-000012'],
  ])('reads %s as order %s', (q, number) => {
    expect(buildOrderWhere({ q }).OR).toContainEqual({ number });
  });

  it('does not read a name as an order number', () => {
    expect(buildOrderWhere({ q: 'inkwell' }).OR).toHaveLength(4);
  });
});
