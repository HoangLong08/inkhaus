import {
  bulkPriceError,
  changedFields,
  countStocking,
  isBuiltInSize,
  priceFieldError,
  sizeDeleteError,
  stocksSize,
  touchesPrice,
} from './admin-catalog.rules';

describe('touchesPrice', () => {
  it('is false for a content-only patch', () => {
    expect(touchesPrice({})).toBe(false);
  });

  it.each([[{ price: 21 }], [{ bulkPrice: 9 }], [{ price: 21, bulkPrice: 9 }]])(
    '%j sets a price',
    (dto) => {
      expect(touchesPrice(dto)).toBe(true);
    },
  );

  it('counts a price that is present even when it is unchanged or zero', () => {
    // presence, not value: a staff body must not carry the key at all
    expect(touchesPrice({ price: 0 })).toBe(true);
    expect(touchesPrice({ bulkPrice: null })).toBe(true);
  });
});

describe('priceFieldError', () => {
  it('lets anyone send a patch without prices', () => {
    expect(priceFieldError('STAFF', {})).toBeNull();
  });

  it('refuses staff a price field', () => {
    expect(priceFieldError('STAFF', { price: 21 })).toBe('Only an owner can change prices.');
    expect(priceFieldError('STAFF', { bulkPrice: 9 })).toBe('Only an owner can change prices.');
  });

  it('lets an owner set prices', () => {
    expect(priceFieldError('OWNER', { price: 21, bulkPrice: 9 })).toBeNull();
  });
});

describe('bulkPriceError', () => {
  const current = { price: 20, bulkPrice: 9 };

  it('accepts a patch that leaves prices alone', () => {
    expect(bulkPriceError(current)).toBeNull();
  });

  it('accepts a bulk price equal to the price', () => {
    expect(bulkPriceError(current, { bulkPrice: 20 })).toBeNull();
  });

  it('refuses a bulk price above the stored price', () => {
    expect(bulkPriceError(current, { bulkPrice: 25 })).toMatch(/cannot be more than/);
  });

  it('refuses a price lowered below the stored bulk price - the merged values decide', () => {
    expect(bulkPriceError(current, { price: 8 })).toBe(
      'The bulk price (9.00) cannot be more than the single-unit price (8.00).',
    );
  });

  it('accepts both moving together into a valid pair', () => {
    expect(bulkPriceError(current, { price: 8, bulkPrice: 5 })).toBeNull();
  });
});

describe('size runs', () => {
  it('reads an empty run as the default apparel run', () => {
    expect(stocksSize([], 'M')).toBe(true);
    expect(stocksSize([], 'OS')).toBe(false);
    expect(stocksSize([], 'E2E')).toBe(false);
  });

  it('reads an explicit run as exactly that', () => {
    expect(stocksSize(['OS'], 'OS')).toBe(true);
    expect(stocksSize(['OS'], 'M')).toBe(false);
  });

  it('counts the products stocking a code', () => {
    const runs = [[], ['OS'], ['S', 'M', '4XL'], []];
    expect(countStocking(runs, 'M')).toBe(3);
    expect(countStocking(runs, 'OS')).toBe(1);
    expect(countStocking(runs, '4XL')).toBe(1);
    expect(countStocking(runs, 'E2E')).toBe(0);
  });

  it('knows the built-in codes', () => {
    expect(isBuiltInSize('XS')).toBe(true);
    expect(isBuiltInSize('3XL')).toBe(true);
    expect(isBuiltInSize('OS')).toBe(true);
    expect(isBuiltInSize('4XL')).toBe(false);
  });
});

describe('sizeDeleteError', () => {
  it.each(['XS', 'M', '3XL', 'OS'])('refuses %s, which is in the default run', (code) => {
    expect(sizeDeleteError(code, 0)).toMatch(/default size run/);
  });

  it('refuses a code a product stocks', () => {
    expect(sizeDeleteError('4XL', 1)).toBe(
      '4XL is stocked by 1 product; take it out of their size runs first.',
    );
    expect(sizeDeleteError('4XL', 3)).toMatch(/stocked by 3 products/);
  });

  it('allows a free code', () => {
    expect(sizeDeleteError('E2E', 0)).toBeNull();
  });
});

describe('changedFields', () => {
  it('keeps only what changed, before and after', () => {
    expect(
      changedFields(
        { name: 'Tee', price: 20, sizes: ['S', 'M'], printArea: { x: 1, y: 2 } },
        { name: 'Tee', price: 21, sizes: ['S', 'M'], printArea: { x: 1, y: 3 } },
      ),
    ).toEqual({
      before: { price: 20, printArea: { x: 1, y: 2 } },
      after: { price: 21, printArea: { x: 1, y: 3 } },
    });
  });

  it('is empty for a no-op', () => {
    expect(changedFields({ a: [1, 2] }, { a: [1, 2] })).toEqual({ before: {}, after: {} });
  });

  it('treats a reordered array as a change - colour order is what the storefront shows', () => {
    expect(changedFields({ colors: ['white', 'black'] }, { colors: ['black', 'white'] }).after).toEqual({
      colors: ['black', 'white'],
    });
  });
});
