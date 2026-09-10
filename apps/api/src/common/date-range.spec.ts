import { BadRequestException } from '@nestjs/common';

import { resolveRange } from './date-range';

// late in the UTC day on purpose: it is still the 11th, whatever zone the
// machine running the test is in
const NOW = new Date('2026-09-11T23:30:00Z');

describe('resolveRange', () => {
  it('defaults to the last 30 days, today included', () => {
    const r = resolveRange({}, NOW);
    expect(r.days).toHaveLength(30);
    expect(r.days[0]).toBe('2026-08-13');
    expect(r.days.at(-1)).toBe('2026-09-11');
    expect(r.from.toISOString()).toBe('2026-08-13T00:00:00.000Z');
    expect(r.toExclusive.toISOString()).toBe('2026-09-12T00:00:00.000Z');
  });

  it('honours a different default', () => {
    expect(resolveRange({}, NOW, { defaultDays: 7 }).days).toHaveLength(7);
  });

  it('reads a preset as ending today', () => {
    expect(resolveRange({ range: '7d' }, NOW).days).toEqual([
      '2026-09-05',
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
    ]);
    expect(resolveRange({ range: '365d' }, NOW).days).toHaveLength(365);
  });

  it('treats from and to as inclusive UTC days', () => {
    const r = resolveRange({ from: '2026-08-15', to: '2026-08-15' }, NOW);
    expect(r.days).toEqual(['2026-08-15']);
    expect(r.from.toISOString()).toBe('2026-08-15T00:00:00.000Z');
    expect(r.toExclusive.toISOString()).toBe('2026-08-16T00:00:00.000Z');
  });

  it('lets an explicit from/to win over a preset', () => {
    expect(resolveRange({ from: '2026-08-01', to: '2026-08-03', range: '90d' }, NOW).days).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
    ]);
  });

  it('runs `from` alone up to today', () => {
    expect(resolveRange({ from: '2026-09-09' }, NOW).days).toEqual([
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
    ]);
  });

  it('reaches back the default from `to` alone', () => {
    expect(resolveRange({ to: '2026-08-31' }, NOW, { defaultDays: 3 }).days).toEqual([
      '2026-08-29',
      '2026-08-30',
      '2026-08-31',
    ]);
  });

  it('crosses a leap day', () => {
    expect(resolveRange({ from: '2028-02-28', to: '2028-03-01' }, NOW).days).toEqual([
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
  });

  it('refuses an inverted range', () => {
    expect(() => resolveRange({ from: '2026-08-03', to: '2026-08-01' }, NOW)).toThrow(
      BadRequestException,
    );
  });

  it('refuses a range longer than maxDays, and accepts one exactly that long', () => {
    expect(resolveRange({ from: '2025-01-01', to: '2026-01-01' }, NOW).days).toHaveLength(366);
    expect(() => resolveRange({ from: '2025-01-01', to: '2026-01-02' }, NOW)).toThrow(
      BadRequestException,
    );
    expect(() => resolveRange({ range: '30d' }, NOW, { maxDays: 7 })).toThrow(BadRequestException);
  });

  it.each(['2026-02-30', '2026-13-01', '2026-9-1', '11/09/2026', '2026-09-11T00:00:00Z'])(
    'refuses %s as a day',
    (day) => {
      expect(() => resolveRange({ from: day }, NOW)).toThrow(BadRequestException);
    },
  );

  it('refuses a preset it does not know', () => {
    expect(() => resolveRange({ range: '14d' }, NOW)).toThrow(BadRequestException);
  });
});
