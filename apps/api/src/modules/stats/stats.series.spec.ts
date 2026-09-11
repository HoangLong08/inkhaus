import { resolveRange } from '../../common/date-range';
import { conversionRate, fillDailySeries } from './stats.series';

// late in the UTC day on purpose: it is still the 11th, whatever zone the
// machine running the test is in
const NOW = new Date('2026-09-11T23:30:00Z');

const days = (from: string, to: string) => resolveRange({ from, to }, NOW).days;
const at = (iso: string) => new Date(iso);

describe('fillDailySeries', () => {
  it('zero-fills every day across a month boundary', () => {
    expect(
      fillDailySeries(days('2026-01-30', '2026-02-02'), [
        { day: at('2026-02-01T00:00:00Z'), orders: 2, revenue: 80 },
      ]),
    ).toEqual([
      { date: '2026-01-30', orders: 0, revenue: 0 },
      { date: '2026-01-31', orders: 0, revenue: 0 },
      { date: '2026-02-01', orders: 2, revenue: 80 },
      { date: '2026-02-02', orders: 0, revenue: 0 },
    ]);
  });

  it('zero-fills every day across a year boundary', () => {
    expect(
      fillDailySeries(days('2025-12-30', '2026-01-02'), [
        { day: at('2025-12-31T00:00:00Z'), orders: 1, revenue: 25.5 },
        { day: at('2026-01-01T00:00:00Z'), orders: 3, revenue: 120 },
      ]),
    ).toEqual([
      { date: '2025-12-30', orders: 0, revenue: 0 },
      { date: '2025-12-31', orders: 1, revenue: 25.5 },
      { date: '2026-01-01', orders: 3, revenue: 120 },
      { date: '2026-01-02', orders: 0, revenue: 0 },
    ]);
  });

  it('answers a quiet range with a zero for every day, not an empty list', () => {
    const series = fillDailySeries(days('2026-09-05', '2026-09-11'), []);
    expect(series).toHaveLength(7);
    expect(series.every((point) => point.orders === 0 && point.revenue === 0)).toBe(true);
  });

  it('counts an order from the last minute of the last UTC day on that day', () => {
    const range = days('2026-09-10', '2026-09-11');
    expect(
      fillDailySeries(range, [{ day: at('2026-09-11T23:59:59.999Z'), orders: 1, revenue: 19.99 }]),
    ).toEqual([
      { date: '2026-09-10', orders: 0, revenue: 0 },
      { date: '2026-09-11', orders: 1, revenue: 19.99 },
    ]);
  });

  it('drops a bucket from the first instant after the range', () => {
    const series = fillDailySeries(days('2026-09-10', '2026-09-11'), [
      { day: at('2026-09-12T00:00:00Z'), orders: 4, revenue: 400 },
    ]);
    expect(series.map((point) => point.orders)).toEqual([0, 0]);
  });

  it('adds up buckets that share a day and rounds revenue to cents', () => {
    expect(
      fillDailySeries(days('2026-09-11', '2026-09-11'), [
        { day: at('2026-09-11T01:00:00Z'), orders: 1, revenue: 0.1 },
        { day: at('2026-09-11T22:00:00Z'), orders: 1, revenue: 0.2 },
      ]),
    ).toEqual([{ date: '2026-09-11', orders: 2, revenue: 0.3 }]);
  });
});

describe('conversionRate', () => {
  it('is null when nothing has been won or lost yet', () => {
    expect(conversionRate(0, 0)).toBeNull();
  });

  it('is won out of won and lost', () => {
    expect(conversionRate(3, 1)).toBe(0.75);
    expect(conversionRate(0, 4)).toBe(0);
    expect(conversionRate(2, 0)).toBe(1);
  });

  it('rounds to four places', () => {
    expect(conversionRate(2, 1)).toBe(0.6667);
  });
});
