import {
  ADMIN_ACTIONS,
  can,
  canConvertQuote,
  canSetQuoteStatus,
  QUOTE_STATUSES,
  staffChangeError,
  TIERS,
  trackingUrl,
  validateTiers,
  type AdminAction,
  type CarrierCode,
  type Tier,
} from '@inkhaus/shared';

/**
 * The rules in @inkhaus/shared that this API enforces and the admin app
 * mirrors. They are pure, so they are pinned here once rather than through
 * every screen that reads them.
 */

describe('can()', () => {
  // Spelled out rather than read back from ADMIN_CAPABILITIES: a test that
  // derives its expectations from the table it checks passes whatever the
  // table says. Moving a capability between these lists is a security change,
  // and it should have to touch this file.
  const EVERYONE: AdminAction[] = [
    'stats.view',
    'orders.view',
    'orders.advance',
    'orders.note',
    'orders.tracking',
    'quotes.manage',
    'quotes.convert',
    'customers.view',
    'customers.edit',
    'catalog.view',
    'catalog.edit',
    'reviews.moderate',
  ];
  const OWNERS_ONLY: AdminAction[] = [
    'orders.export',
    'designs.view',
    'catalog.price',
    'catalog.create',
    'reviews.delete',
    'staff.view',
    'staff.manage',
  ];

  it('knows every capability, each exactly once', () => {
    expect([...EVERYONE, ...OWNERS_ONLY].sort()).toEqual([...ADMIN_ACTIONS].sort());
  });

  it.each(EVERYONE)('%s is open to owners and staff', (action) => {
    expect(can('OWNER', action)).toBe(true);
    expect(can('STAFF', action)).toBe(true);
  });

  it.each(OWNERS_ONLY)('%s is kept to owners', (action) => {
    expect(can('OWNER', action)).toBe(true);
    expect(can('STAFF', action)).toBe(false);
  });
});

describe('staffChangeError()', () => {
  const owner = { id: 'owner-1', role: 'OWNER' as const };
  const ownerRow = { ...owner, isActive: true };
  const otherOwner = { id: 'owner-2', role: 'OWNER' as const, isActive: true };
  const staffMember = { id: 'staff-1', role: 'STAFF' as const, isActive: true };

  it('refuses anyone but an owner', () => {
    expect(staffChangeError({ id: 'staff-2', role: 'STAFF' }, staffMember, { isActive: false }, 2))
      .toMatchObject({ code: 'NOT_OWNER' });
  });

  it('refuses changing your own role or deactivating yourself', () => {
    expect(staffChangeError(owner, ownerRow, { role: 'STAFF' }, 3)).toMatchObject({ code: 'SELF' });
    expect(staffChangeError(owner, ownerRow, { isActive: false }, 3)).toMatchObject({
      code: 'SELF',
    });
  });

  it('refuses losing the last active owner', () => {
    expect(staffChangeError(owner, otherOwner, { role: 'STAFF' }, 1)).toMatchObject({
      code: 'LAST_OWNER',
    });
    expect(staffChangeError(owner, otherOwner, { isActive: false }, 1)).toMatchObject({
      code: 'LAST_OWNER',
    });
  });

  it('allows everything else', () => {
    expect(staffChangeError(owner, otherOwner, { role: 'STAFF' }, 2)).toBeNull();
    expect(staffChangeError(owner, staffMember, { role: 'OWNER' }, 1)).toBeNull();
    expect(staffChangeError(owner, staffMember, { isActive: false }, 1)).toBeNull();
    // re-sending your own current role is not a change
    expect(staffChangeError(owner, ownerRow, { role: 'OWNER' }, 1)).toBeNull();
  });
});

describe('validateTiers()', () => {
  it('accepts the ladder the shop ships with', () => {
    expect(validateTiers(TIERS)).toBeNull();
  });

  it.each<[string, Tier[]]>([
    ['no tiers', []],
    ['a first tier above one unit', [{ min: 2, off: 0 }]],
    ['a discount on the first tier', [{ min: 1, off: 0.1 }]],
    [
      'quantities that do not increase',
      [
        { min: 1, off: 0 },
        { min: 12, off: 0.1 },
        { min: 12, off: 0.2 },
      ],
    ],
    [
      'a discount that shrinks',
      [
        { min: 1, off: 0 },
        { min: 6, off: 0.2 },
        { min: 12, off: 0.1 },
      ],
    ],
    [
      'a discount over 90%',
      [
        { min: 1, off: 0 },
        { min: 6, off: 0.95 },
      ],
    ],
    [
      'a fractional quantity',
      [
        { min: 1, off: 0 },
        { min: 6.5, off: 0.1 },
      ],
    ],
    [
      'a percentage finer than a tenth',
      [
        { min: 1, off: 0 },
        { min: 6, off: 0.1234 },
      ],
    ],
    ['more than twelve tiers', Array.from({ length: 13 }, (_, i) => ({ min: i + 1, off: i / 100 }))],
  ])('refuses %s', (_label, tiers) => {
    expect(validateTiers(tiers)).toEqual(expect.any(String));
  });
});

describe('quote rules', () => {
  it('converts an open quote once, and never a lost one', () => {
    expect(canConvertQuote({ status: 'NEW', convertedOrderId: null })).toBe(true);
    expect(canConvertQuote({ status: 'CONTACTED', convertedOrderId: null })).toBe(true);
    expect(canConvertQuote({ status: 'WON', convertedOrderId: null })).toBe(true);
    expect(canConvertQuote({ status: 'LOST', convertedOrderId: null })).toBe(false);
    expect(canConvertQuote({ status: 'WON', convertedOrderId: 'ord_1' })).toBe(false);
  });

  it('moves an unconverted quote anywhere', () => {
    for (const to of QUOTE_STATUSES) {
      expect(canSetQuoteStatus({ convertedOrderId: null }, to)).toBe(true);
    }
  });

  it('pins a converted quote to WON', () => {
    const converted = { convertedOrderId: 'ord_1' };
    expect(canSetQuoteStatus(converted, 'WON')).toBe(true);
    expect(canSetQuoteStatus(converted, 'NEW')).toBe(false);
    expect(canSetQuoteStatus(converted, 'CONTACTED')).toBe(false);
    expect(canSetQuoteStatus(converted, 'LOST')).toBe(false);
  });
});

describe('trackingUrl()', () => {
  const NUMBER = '1Z999AA10123456784';

  it.each<[CarrierCode, string | null]>([
    ['USPS', `https://tools.usps.com/go/TrackConfirmAction?tLabels=${NUMBER}`],
    ['UPS', `https://www.ups.com/track?tracknum=${NUMBER}`],
    ['FEDEX', `https://www.fedex.com/fedextrack/?trknbr=${NUMBER}`],
    ['DHL', `https://www.dhl.com/us-en/home/tracking/tracking-express.html?tracking-id=${NUMBER}`],
    ['OTHER', null],
  ])('%s', (carrier, url) => {
    expect(trackingUrl(carrier, NUMBER)).toBe(url);
  });

  it('trims and encodes the number', () => {
    expect(trackingUrl('UPS', ' 1Z 999 ')).toBe('https://www.ups.com/track?tracknum=1Z%20999');
  });
});
