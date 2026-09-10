import { ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import configuration from '../../config/configuration';
import { PriceEditsPolicy } from './price-edits.policy';

const policy = (flag: unknown) =>
  new PriceEditsPolicy({ get: jest.fn().mockReturnValue(flag) } as unknown as ConfigService);

describe('PriceEditsPolicy', () => {
  it('refuses price edits with a 409 while the flag is off', () => {
    const p = policy(false);
    expect(p.enabled).toBe(false);
    expect(() => p.assertEnabled()).toThrow(ConflictException);
    expect(() => p.assertEnabled()).toThrow(
      'Price edits are disabled until the storefront reads prices from the API.',
    );
  });

  it('treats a missing flag as off', () => {
    expect(policy(undefined).enabled).toBe(false);
    expect(() => policy(undefined).assertEnabled()).toThrow(ConflictException);
  });

  it('allows them once the flag is on', () => {
    const p = policy(true);
    expect(p.enabled).toBe(true);
    expect(() => p.assertEnabled()).not.toThrow();
  });
});

describe('CATALOG_PRICE_EDITS', () => {
  const original = process.env.CATALOG_PRICE_EDITS;

  afterEach(() => {
    if (original === undefined) delete process.env.CATALOG_PRICE_EDITS;
    else process.env.CATALOG_PRICE_EDITS = original;
  });

  it.each([
    [undefined, false],
    ['', false],
    ['false', false],
    ['1', false],
    ['TRUE', false],
    ['true', true],
  ])('%j turns price edits %s', (value, expected) => {
    if (value === undefined) delete process.env.CATALOG_PRICE_EDITS;
    else process.env.CATALOG_PRICE_EDITS = value;

    expect(configuration().catalogPriceEdits).toBe(expected);
  });
});
