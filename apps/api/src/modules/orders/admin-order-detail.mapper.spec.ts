import { Prisma } from '@prisma/client';

import { toAdminOrderDetail, type AdminOrderRow, type PreviewSides } from './admin-order-detail.mapper';
import { toPublicOrder, type PublicOrderRow } from './orders.service';
import { parseTrackingNote, trackingNote } from './tracking';

const d = (v: string) => new Prisma.Decimal(v);

const PLACED = new Date('2026-09-01T10:00:00Z');
const at = (minutes: number) => new Date(PLACED.getTime() + minutes * 60_000);

const OWNER = { id: 'admin-owner', name: 'Olive Owner', email: 'olive@inkhaus.test' };
const STAFF = { id: 'admin-staff', name: null, email: 'e2e-staff@inkhaus.test' };

/**
 * One timeline with every kind in it, each carrying an actor or not - the rows
 * the database would hand both mappers. The public include never loads a NOTE
 * or an actor, but the public mapper is the last line: it must hold even when a
 * row it is given does.
 */
const EVENTS = [
  { id: 'e1', kind: 'STATUS', status: 'PENDING_PAYMENT', note: 'Order placed', createdAt: at(0), actorId: null, actor: null },
  { id: 'e2', kind: 'STATUS', status: 'PAID', note: null, createdAt: at(1), actorId: STAFF.id, actor: STAFF },
  { id: 'e3', kind: 'NOTE', status: 'PAID', note: 'customer wants it by Friday', createdAt: at(2), actorId: OWNER.id, actor: OWNER },
  { id: 'e4', kind: 'STATUS', status: 'IN_PRODUCTION', note: null, createdAt: at(3), actorId: STAFF.id, actor: STAFF },
  { id: 'e5', kind: 'TRACKING', status: 'IN_PRODUCTION', note: 'UPS 1Z999AA10123456784', createdAt: at(4), actorId: STAFF.id, actor: STAFF },
];

/** the fields both includes share; each mapper reads its own slice */
const base = {
  id: 'ord_1',
  seq: 1,
  number: 'INK-000123',
  status: 'IN_PRODUCTION',
  customerId: 'cus_1',
  subtotal: d('112.00'),
  discount: d('0'),
  shipping: d('8.00'),
  tax: d('0'),
  total: d('120.00'),
  currency: 'USD',
  shipName: 'Riley Keeper',
  shipLine1: '200 Pitch Road',
  shipLine2: null,
  shipCity: 'Denver',
  shipState: 'CO',
  shipPostal: '80202',
  shipCountry: 'US',
  carrier: 'UPS',
  trackingNumber: '1Z999AA10123456784',
  shippedAt: null,
  deliveredAt: null,
  notes: 'please fold, do not roll',
  placedAt: PLACED,
  createdAt: PLACED,
  updatedAt: at(4),
  events: EVENTS,
};

const customer = {
  id: 'cus_1',
  email: 'riley@example.com',
  name: 'Riley Keeper',
  phone: '555-0100',
  company: 'Ridgeline FC',
};

function adminRow(overrides: Partial<Record<string, unknown>> = {}): AdminOrderRow {
  return {
    ...base,
    customer,
    items: [
      {
        id: 'item_1',
        orderId: 'ord_1',
        productId: 'prod_1',
        colorId: 'col_1',
        designId: 'des_1',
        method: 'DTG',
        unitPrice: d('21.60'),
        quantity: 5,
        lineTotal: d('112.00'),
        product: { slug: 'heavyweight-tee', name: 'Heavyweight Tee' },
        color: { slug: 'black', name: 'Black', hex: '#111111' },
        design: { id: 'des_1', publicId: 'k3m9xq2t7p', name: 'Club crest' },
        // stored out of the house order on purpose - the mapper sorts
        sizes: [
          { id: 's2', itemId: 'item_1', size: '2XL', quantity: 2, upcharge: d('2.00') },
          { id: 's1', itemId: 'item_1', size: 'M', quantity: 3, upcharge: d('0') },
        ],
      },
      {
        id: 'item_2',
        orderId: 'ord_1',
        productId: 'prod_2',
        colorId: 'col_2',
        designId: null,
        method: 'SCREEN_PRINT',
        unitPrice: d('9.99'),
        quantity: 3,
        lineTotal: d('29.97'),
        product: { slug: 'tote', name: 'Canvas Tote' },
        color: { slug: 'natural', name: 'Natural', hex: '#EEE8D5' },
        design: null,
        sizes: [{ id: 's3', itemId: 'item_2', size: 'OS', quantity: 3, upcharge: d('0.01') }],
      },
    ],
    convertedFrom: { id: 'quote_1' },
    ...overrides,
  } as unknown as AdminOrderRow;
}

function publicRow(): PublicOrderRow {
  return {
    ...base,
    customer: { ...customer, googleSub: null, avatarUrl: null, adminNote: 'VIP', lastLoginAt: null },
    items: adminRow().items.map((item) => ({
      ...item,
      design: item.design && { ...item.design, previewFront: 'data:image/png;base64,AAAA' },
    })),
  } as unknown as PublicOrderRow;
}

const NO_PREVIEWS: PreviewSides = { front: new Set(), back: new Set() };

describe('toAdminOrderDetail', () => {
  it('lists every size with its quantity and upcharge, beside the line total as stored', () => {
    const [tee, tote] = toAdminOrderDetail(adminRow(), NO_PREVIEWS).items;

    expect(tee.unitPrice).toBe(21.6);
    expect(tee.lineTotal).toBe(112);
    expect(tee.sizes).toEqual([
      { size: 'M', qty: 3, upcharge: 0 },
      { size: '2XL', qty: 2, upcharge: 2 },
    ]);
    expect(tote.sizes).toEqual([{ size: 'OS', qty: 3, upcharge: 0.01 }]);
  });

  it('never recomputes a total from the rounded unit price', () => {
    // 21.99 at 38% off is 13.6338 a unit: checkout charged 24 of them from the
    // unrounded figure (327.21) and stored the unit price rounded (13.63), and
    // 13.63 x 24 is 327.12 - nine cents short of what the customer paid
    const row = adminRow();
    row.items[0] = {
      ...row.items[0],
      unitPrice: d('13.63'),
      quantity: 24,
      lineTotal: d('327.21'),
      sizes: [{ id: 's1', itemId: 'item_1', size: 'M', quantity: 24, upcharge: d('0') }],
    };

    const [tee] = toAdminOrderDetail(row, NO_PREVIEWS).items;
    expect(tee.lineTotal).toBe(327.21);
    expect(tee.sizes).toEqual([{ size: 'M', qty: 24, upcharge: 0 }]);
    expect(JSON.stringify(tee)).not.toContain('327.12');
  });

  it('keeps the house size run in order, custom sizes last', () => {
    const row = adminRow();
    row.items[0].sizes = ['3XL', 'OS', 'XS', 'L'].map((size, i) => ({
      id: `s${i}`,
      itemId: 'item_1',
      size,
      quantity: 1,
      upcharge: d('0'),
    }));

    expect(toAdminOrderDetail(row, NO_PREVIEWS).items[0].sizes.map((s) => s.size)).toEqual([
      'XS',
      'L',
      '3XL',
      'OS',
    ]);
  });

  it('carries every kind of event, oldest first, each with who did it', () => {
    const { timeline } = toAdminOrderDetail(adminRow(), NO_PREVIEWS);

    expect(timeline.map((e) => [e.id, e.kind])).toEqual([
      ['e1', 'STATUS'],
      ['e2', 'STATUS'],
      ['e3', 'NOTE'],
      ['e4', 'STATUS'],
      ['e5', 'TRACKING'],
    ]);
    expect(timeline[0].actor).toBeNull(); // the storefront placed it
    expect(timeline[2]).toEqual({
      id: 'e3',
      kind: 'NOTE',
      status: 'PAID',
      note: 'customer wants it by Friday',
      at: at(2).toISOString(),
      actor: OWNER,
      tracking: null,
    });
  });

  it('links a TRACKING event to its carrier', () => {
    const tracking = toAdminOrderDetail(adminRow(), NO_PREVIEWS).timeline[4].tracking;
    expect(tracking).toEqual({
      carrier: 'UPS',
      number: '1Z999AA10123456784',
      url: 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
    });
  });

  it('carries the customer record, tracking and the quote it came from', () => {
    const detail = toAdminOrderDetail(adminRow(), NO_PREVIEWS);

    expect(detail.customer).toEqual(customer);
    expect(detail.tracking).toEqual({
      carrier: 'UPS',
      number: '1Z999AA10123456784',
      url: 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
    });
    expect(detail.quote).toEqual({ id: 'quote_1' });
    expect(detail.notes).toBe('please fold, do not roll');
    expect(detail.placedAt).toBe(PLACED.toISOString());
    expect(detail.shippedAt).toBeNull();

    const plain = toAdminOrderDetail(
      adminRow({ convertedFrom: null, carrier: null, trackingNumber: null }),
      NO_PREVIEWS,
    );
    expect(plain.quote).toBeNull();
    expect(plain.tracking).toBeNull();
  });

  it('says which sides of a design can be drawn, and never ships the preview itself', () => {
    const detail = toAdminOrderDetail(adminRow(), { front: new Set(['des_1']), back: new Set() });
    const [tee, tote] = detail.items;

    expect(tee.design).toEqual({
      publicId: 'k3m9xq2t7p',
      name: 'Club crest',
      hasFront: true,
      hasBack: false,
    });
    expect(tote.design).toBeNull();
    expect(JSON.stringify(detail)).not.toContain('data:image');
  });
});

describe('toPublicOrder', () => {
  it('drops staff notes and every actor, even when the row carries them', () => {
    const order = toPublicOrder(publicRow());

    expect(order.timeline.map((e) => e.kind)).toEqual(['STATUS', 'STATUS', 'STATUS', 'TRACKING']);
    for (const entry of order.timeline) {
      expect(Object.keys(entry).sort()).toEqual(['at', 'kind', 'note', 'status']);
    }

    const body = JSON.stringify(order);
    expect(body).not.toContain('customer wants it by Friday');
    expect(body).not.toContain(OWNER.email);
    expect(body).not.toContain(STAFF.id);
  });

  it('keeps what the customer is owed and nothing staff wrote about them', () => {
    const order = toPublicOrder(publicRow());

    expect(order.tracking).toEqual({
      carrier: 'UPS',
      number: '1Z999AA10123456784',
      url: 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
    });
    expect(order.customer).toEqual({ email: 'riley@example.com', name: 'Riley Keeper' });
    expect(order.items[0].designId).toBe('k3m9xq2t7p');
    expect(JSON.stringify(order)).not.toContain('VIP');
  });
});

describe('parseTrackingNote', () => {
  it('reads back exactly what trackingNote writes, for every carrier', () => {
    for (const [carrier, number] of [
      ['USPS', '9400111899223197428490'],
      ['UPS', '1Z999AA10123456784'],
      ['FEDEX', '771234567890'],
      ['DHL', '1234567890'],
      ['OTHER', 'LOCAL-42'],
    ] as const) {
      expect(parseTrackingNote(trackingNote({ carrier, number }))).toMatchObject({ carrier, number });
    }
    // no carrier page for OTHER, so no link
    expect(parseTrackingNote('Other LOCAL-42')?.url).toBeNull();
  });

  it('refuses a note it did not write', () => {
    expect(parseTrackingNote(null)).toBeNull();
    expect(parseTrackingNote('left at the front desk')).toBeNull();
    expect(parseTrackingNote('UPS <script>')).toBeNull();
  });
});
