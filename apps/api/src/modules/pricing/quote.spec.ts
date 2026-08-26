import { quote, tierFor, unitPrice } from '@inkhaus/shared';

const TEE = { price: 24, bulkPrice: 11.4 };

describe('volume pricing', () => {
  it('picks the deepest tier the quantity qualifies for', () => {
    expect(tierFor(1).min).toBe(1);
    expect(tierFor(11).min).toBe(6);
    expect(tierFor(12).min).toBe(12);
    expect(tierFor(10_000).min).toBe(250);
  });

  it('never prices below the 50+ floor', () => {
    expect(unitPrice(TEE, 250)).toBe(TEE.bulkPrice);
    expect(unitPrice(TEE, 1)).toBe(TEE.price);
  });

  it('applies the ladder to the total across sizes, not per line', () => {
    const split = quote(TEE, [
      { size: 'M', qty: 6 },
      { size: 'L', qty: 6 },
    ]);
    // 12 units total earns the 12+ tier even though no single size hits it
    expect(split.tier.min).toBe(12);
    expect(split.baseUnitPrice).toBe(18.24);
    expect(split.quantity).toBe(12);
    expect(split.subtotal).toBe(218.88);
  });

  it('adds the blank upcharge per line and reports the saving', () => {
    const q = quote(TEE, [
      { size: 'L', qty: 10 },
      { size: '3XL', qty: 2 },
    ]);
    const big = q.lines.find((l) => l.size === '3XL')!;
    expect(big.upcharge).toBe(4);
    expect(big.unitPrice).toBe(q.baseUnitPrice + 4);
    expect(q.savings).toBe(q.listTotal - q.subtotal);
  });

  it('drops zero-quantity lines from the total', () => {
    const q = quote(TEE, [
      { size: 'S', qty: 0 },
      { size: 'M', qty: 3 },
    ]);
    expect(q.lines).toHaveLength(1);
    expect(q.quantity).toBe(3);
  });
});
