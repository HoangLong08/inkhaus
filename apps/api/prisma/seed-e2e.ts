/**
 * Fixtures the e2e suites need, kept out of `seed.ts` so a real deployment never
 * grows a test account.
 *
 *   npm run db:seed:e2e -w @inkhaus/api
 *
 * Rebuilt on every run, not topped up: each fixture is put back to exactly the
 * state below, so whatever a suite edited, spent or deleted last time is not
 * this run's problem. Every row lives in its own namespace - `e2e-*` addresses
 * and slugs, review authors starting `E2E `, order numbers `INK-900xxx` - and
 * nothing outside it is written. (The API numbers real orders from a sequence,
 * INK-000017 and up, so the 900xxx block never meets one.)
 *
 * What is here, and why:
 *
 *   - one STAFF account. The bootstrap accounts are all OWNER, so without it
 *     there is nobody for the role tests to refuse.
 *   - INK-900001, a SHIPPED order under the storefront test shopper's ADDRESS,
 *     filed before that person has ever signed in - exactly the state a guest
 *     checkout leaves. If /account can show it after a first-ever sign-in,
 *     guest orders really do come with the account. The web suite asserts it.
 *   - a pool of PENDING_PAYMENT orders for the status tests to spend. The
 *     transition table has no way back to PENDING_PAYMENT - correct for the
 *     product, unhelpful for a fixture - so all six are rebuilt every run. This
 *     used to be done by flipping arbitrary real dev orders back to
 *     PENDING_PAYMENT, which quietly rewrote order history; it no longer is.
 *   - a customer with a saved design and three orders in different states,
 *     three bulk quotes, five reviews across the moderation states, and an
 *     archived product and colour the catalog tests may edit freely.
 *
 * Every constant below is mirrored in apps/admin/e2e/fixtures.ts, which is what
 * the specs import - the API cannot import from an app's test folder, and the
 * test folder must not import from the API. Change one, change the other.
 */
// first, and before @prisma/client: DATABASE_URL comes from the repo-root .env
import '../src/load-env';

import {
  AdminRole,
  GarmentType,
  OrderEventKind,
  OrderStatus,
  PrintMethod,
  Prisma,
  PrismaClient,
  QuoteEventKind,
  QuoteStatus,
  ReviewStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

// ------------------------------- mirrored in apps/admin/e2e/fixtures.ts ----

export const E2E_STAFF_EMAIL = 'e2e-staff@inkhaus.test';
/** staff.spec invites addresses with this prefix; every run deletes them */
const INVITEE_PREFIX = 'e2e-invitee';

export const E2E_SHOPPER_EMAIL = 'e2e-shopper@inkhaus.test';
/** fixed, so a re-run rebuilds the same row instead of stacking up orders */
const E2E_SHOPPER_ORDER = 'INK-900001';

const POOL = ['INK-900101', 'INK-900102', 'INK-900103', 'INK-900104', 'INK-900105', 'INK-900106'];
const POOL_EMAIL = 'e2e-pool@inkhaus.test';

const CUSTOMER_EMAIL = 'e2e-customer@inkhaus.test';
const CUSTOMER_NAME = 'E2E Customer';
const CUSTOMER_COMPANY = 'Ridgeline FC';
const CUSTOMER_PHONE = '555-0100';
const DESIGN_ID = 'e2e-design-01';
/** totals as seeded: 120.00, 374.40 and 238.40 - fixtures.ts ORDER_TOTALS */
const ORDER_PAID = 'INK-900002';
const ORDER_IN_PRODUCTION = 'INK-900003';
const ORDER_DELIVERED = 'INK-900004';
/** the one day the orders date-filter test narrows to - fixtures.ts ORDER_DELIVERED_DAY */
const ORDER_DELIVERED_PLACED_AT = new Date('2026-08-15T12:00:00Z');

const QUOTE_PREFIX = 'e2e-quote';
const QUOTE_NEW_EMAIL = 'e2e-quote-new@inkhaus.test';
const QUOTE_CONTACTED_EMAIL = 'e2e-quote-contacted@inkhaus.test';
const QUOTE_CONVERT_EMAIL = 'e2e-quote-convert@inkhaus.test';
const QUOTE_COMPANY = 'E2E Athletics';
const QUOTE_PRODUCT = 'heavyweight-tee';

/** 3 PENDING, 1 PUBLISHED, 1 REJECTED - fixtures.ts REVIEW_COUNTS */
const REVIEW_AUTHOR_PREFIX = 'E2E ';

const TEST_PRODUCT = 'e2e-test-blank';
const TEST_COLOR = 'e2e-teal';
/** never created here - catalog.spec creates and deletes it; a leftover is removed */
const TEST_SIZE = 'E2E';

// ---------------------------------------------------------------------------

/** a real 1x1 PNG, so the design preview route has an image to decode */
const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** the product and colour the order, design and review fixtures hang off */
type Base = { id: string; colorId: string };

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('refusing to seed e2e fixtures into a production database');
  }

  const base = await baseProduct();
  const sizeRemoved = await seedCatalogFixtures();
  const staff = await seedStaff();
  await seedShopperOrder(base);
  await seedPool(base);
  await seedCustomer(base);
  const converted = await seedQuotes(staff.id);
  await seedReviews(base.id);

  console.log(
    [
      `  staff account    ${E2E_STAFF_EMAIL} (STAFF, active)` +
        (staff.inviteesRemoved ? `; removed ${staff.inviteesRemoved} invitee(s)` : ''),
      `  shopper order    ${E2E_SHOPPER_ORDER} SHIPPED for ${E2E_SHOPPER_EMAIL}`,
      `  actionable pool  ${POOL[0]}..${POOL.at(-1)} PENDING_PAYMENT for ${POOL_EMAIL}`,
      `  customer         ${CUSTOMER_EMAIL}: ${ORDER_PAID} PAID, ${ORDER_IN_PRODUCTION} IN_PRODUCTION, ` +
        `${ORDER_DELIVERED} DELIVERED; design ${DESIGN_ID}`,
      `  bulk quotes      ${QUOTE_NEW_EMAIL} NEW, ${QUOTE_CONTACTED_EMAIL} CONTACTED (follow-up overdue), ` +
        `${QUOTE_CONVERT_EMAIL} NEW` +
        (converted ? `; removed ${converted} converted order(s)` : ''),
      `  reviews          3 PENDING, 1 PUBLISHED, 1 REJECTED`,
      `  catalog          ${TEST_PRODUCT} and colour ${TEST_COLOR}, both archived` +
        (sizeRemoved ? `; removed size ${TEST_SIZE}` : ''),
    ].join('\n'),
  );
}

/**
 * The first product on the shelf and its first colour - whatever the back
 * office has made that. Never the test blank, which the catalog tests edit.
 */
async function baseProduct(): Promise<Base> {
  const product = await prisma.product.findFirst({
    where: { slug: { not: TEST_PRODUCT }, colors: { some: {} } },
    orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
    include: { colors: { orderBy: { sortOrder: 'asc' }, take: 1 } },
  });
  if (!product) throw new Error('no catalog in the database - run `npm run db:seed` first');
  return { id: product.id, colorId: product.colors[0].colorId };
}

// ------------------------------------------------------------------- staff

async function seedStaff() {
  const staff = await prisma.adminUser.upsert({
    where: { email: E2E_STAFF_EMAIL },
    // all four reset: staff.spec promotes, demotes and finally deactivates it
    update: { role: AdminRole.STAFF, isActive: true, deactivatedAt: null, name: 'E2E Staff' },
    create: { email: E2E_STAFF_EMAIL, name: 'E2E Staff', role: AdminRole.STAFF },
  });

  // their sessions cascade; anything they authored keeps its row with a null actor
  const invitees = await prisma.adminUser.deleteMany({
    where: { email: { startsWith: INVITEE_PREFIX } },
  });

  return { id: staff.id, inviteesRemoved: invitees.count };
}

// ------------------------------------------------------------------ orders

type FixtureOrder = {
  number: string;
  customerId: string;
  /** the statuses it has been through, oldest first; the last is where it sits */
  history: OrderStatus[];
  placedAt: Date;
  /** time between one history entry and the next */
  step?: number;
  /** tier price for one unit, before size upcharges */
  unitPrice: string;
  sizes: { size: string; quantity: number; upcharge?: string }[];
  shipping?: string;
  designId?: string;
  ship: { name: string; line1: string; city: string; state: string; postal: string };
  tracking?: { carrier: string; number: string };
};

const EVENT_NOTE: Partial<Record<OrderStatus, string>> = {
  PENDING_PAYMENT: 'Order placed',
  PAID: 'Payment received',
  IN_PRODUCTION: 'On the press',
  SHIPPED: 'Handed to the carrier',
  DELIVERED: 'Delivered',
};

const cents = (usd: string) => Math.round(Number(usd) * 100);
const money = (c: number) => new Prisma.Decimal((c / 100).toFixed(2));

/**
 * Built straight through Prisma rather than through the API's order builder:
 * these numbers are a backdrop, and running them through the live price ladder
 * would make every fixture fail whenever a price changed - which is a pricing
 * test's job and not this one's. The arithmetic is still the real one (`quote()`
 * in @inkhaus/shared: each size line is (tier price + upcharge) x quantity), so
 * the totals a spec reads back add up.
 */
async function createFixtureOrder(o: FixtureOrder, product: Base) {
  const unit = cents(o.unitPrice);
  const quantity = o.sizes.reduce((n, s) => n + s.quantity, 0);
  const line = o.sizes.reduce((sum, s) => sum + (unit + cents(s.upcharge ?? '0')) * s.quantity, 0);
  const shipping = cents(o.shipping ?? '0');

  const at = (i: number) => new Date(o.placedAt.getTime() + i * (o.step ?? 2 * HOUR));
  const reached = (status: OrderStatus) => {
    const i = o.history.indexOf(status);
    return i < 0 ? null : at(i);
  };

  await prisma.order.create({
    data: {
      number: o.number,
      status: o.history[o.history.length - 1],
      customerId: o.customerId,
      subtotal: money(line),
      shipping: money(shipping),
      tax: money(0),
      total: money(line + shipping),
      shipName: o.ship.name,
      shipLine1: o.ship.line1,
      shipCity: o.ship.city,
      shipState: o.ship.state,
      shipPostal: o.ship.postal,
      shipCountry: 'US',
      carrier: o.tracking?.carrier ?? null,
      trackingNumber: o.tracking?.number ?? null,
      shippedAt: reached(OrderStatus.SHIPPED),
      deliveredAt: reached(OrderStatus.DELIVERED),
      placedAt: o.placedAt,
      createdAt: o.placedAt,
      items: {
        create: {
          productId: product.id,
          colorId: product.colorId,
          designId: o.designId ?? null,
          method: PrintMethod.DTG,
          unitPrice: money(unit),
          quantity,
          lineTotal: money(line),
          sizes: {
            create: o.sizes.map((s) => ({
              size: s.size,
              quantity: s.quantity,
              upcharge: money(cents(s.upcharge ?? '0')),
            })),
          },
        },
      },
      events: {
        create: o.history.map((status, i) => ({
          kind: OrderEventKind.STATUS,
          status,
          note: EVENT_NOTE[status] ?? null,
          createdAt: at(i),
        })),
      },
    },
  });
}

/**
 * One shipped order under the shopper's address, with no `googleSub` on the
 * customer row - the state a guest checkout leaves behind.
 */
async function seedShopperOrder(base: Base) {
  const customer = await prisma.customer.upsert({
    where: { email: E2E_SHOPPER_EMAIL },
    update: {},
    create: { email: E2E_SHOPPER_EMAIL, name: 'E2E Shopper' },
  });

  // Rebuilt rather than updated: items, sizes and events hang off the order,
  // and deleting it cascades them away in one step.
  await prisma.order.deleteMany({ where: { number: E2E_SHOPPER_ORDER } });

  await createFixtureOrder(
    {
      number: E2E_SHOPPER_ORDER,
      customerId: customer.id,
      history: [OrderStatus.PENDING_PAYMENT, OrderStatus.SHIPPED],
      placedAt: new Date('2026-08-01T10:00:00Z'),
      unitPrice: '14.00',
      sizes: [
        { size: 'M', quantity: 3 },
        { size: 'L', quantity: 3 },
      ],
      ship: { name: 'E2E Shopper', line1: '1 Test Street', city: 'Charlotte', state: 'NC', postal: '28202' },
    },
    base,
  );
}

/**
 * What the status tests spend. Placed a second apart and newest last, so the
 * API's newest-first list - which `findActionableOrder` reads - always leads
 * with the pool.
 */
async function seedPool(base: Base) {
  const customer = await prisma.customer.upsert({
    where: { email: POOL_EMAIL },
    update: { name: 'E2E Pool' },
    create: { email: POOL_EMAIL, name: 'E2E Pool' },
  });

  await prisma.order.deleteMany({ where: { number: { in: POOL } } });

  const now = Date.now();
  for (const [i, number] of POOL.entries()) {
    await createFixtureOrder(
      {
        number,
        customerId: customer.id,
        history: [OrderStatus.PENDING_PAYMENT],
        placedAt: new Date(now - (POOL.length - i) * 1000),
        unitPrice: '24.00',
        sizes: [
          { size: 'M', quantity: 2 },
          { size: 'L', quantity: 2 },
        ],
        shipping: '8.00',
        ship: { name: 'E2E Pool', line1: '3 Queue Lane', city: 'Austin', state: 'TX', postal: '78701' },
      },
      base,
    );
  }
}

/** a customer with a design and three orders, every editable field reset */
async function seedCustomer(base: Base) {
  const customer = await prisma.customer.upsert({
    where: { email: CUSTOMER_EMAIL },
    update: { name: CUSTOMER_NAME, company: CUSTOMER_COMPANY, phone: CUSTOMER_PHONE, adminNote: null },
    create: { email: CUSTOMER_EMAIL, name: CUSTOMER_NAME, company: CUSTOMER_COMPANY, phone: CUSTOMER_PHONE },
  });

  const design = {
    name: 'E2E Crest',
    productId: base.id,
    colorId: base.colorId,
    scene: { front: {}, back: {} },
    previewFront: PNG_1X1,
    previewBack: null,
    customerId: customer.id,
  };
  const { id: designId } = await prisma.design.upsert({
    where: { publicId: DESIGN_ID },
    update: design,
    create: { publicId: DESIGN_ID, ...design },
  });

  await prisma.order.deleteMany({
    where: { number: { in: [ORDER_PAID, ORDER_IN_PRODUCTION, ORDER_DELIVERED] } },
  });

  const now = Date.now();
  const ship = { name: CUSTOMER_NAME, line1: '200 Pitch Road', city: 'Denver', state: 'CO', postal: '80202' };

  // 21.60 x 3 + (21.60 + 2.00) x 2 = 112.00, + 8.00 shipping = 120.00
  await createFixtureOrder(
    {
      number: ORDER_PAID,
      customerId: customer.id,
      history: [OrderStatus.PENDING_PAYMENT, OrderStatus.PAID],
      placedAt: new Date(now - 2 * DAY),
      unitPrice: '21.60',
      sizes: [
        { size: 'M', quantity: 3 },
        { size: '2XL', quantity: 2, upcharge: '2.00' },
      ],
      shipping: '8.00',
      designId,
      ship,
    },
    base,
  );

  // no tracking on purpose: the ship test has to supply it. 15.60 x 24 = 374.40
  await createFixtureOrder(
    {
      number: ORDER_IN_PRODUCTION,
      customerId: customer.id,
      history: [OrderStatus.PENDING_PAYMENT, OrderStatus.PAID, OrderStatus.IN_PRODUCTION],
      placedAt: new Date(now - 5 * DAY),
      unitPrice: '15.60',
      sizes: [
        { size: 'L', quantity: 12 },
        { size: 'XL', quantity: 12 },
      ],
      ship,
    },
    base,
  );

  // a fixed date, one event a day through to delivery. 19.20 x 12 + 8.00 = 238.40
  await createFixtureOrder(
    {
      number: ORDER_DELIVERED,
      customerId: customer.id,
      history: [
        OrderStatus.PENDING_PAYMENT,
        OrderStatus.PAID,
        OrderStatus.IN_PRODUCTION,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
      ],
      placedAt: ORDER_DELIVERED_PLACED_AT,
      step: DAY,
      unitPrice: '19.20',
      sizes: [
        { size: 'M', quantity: 6 },
        { size: 'L', quantity: 6 },
      ],
      shipping: '8.00',
      tracking: { carrier: 'UPS', number: '1Z999AA10123456784' },
      ship,
    },
    base,
  );
}

// ------------------------------------------------------------- bulk quotes

async function seedQuotes(staffId: string) {
  const product = await prisma.product.findUnique({
    where: { slug: QUOTE_PRODUCT },
    select: { id: true },
  });
  if (!product) throw new Error(`the quote fixtures need product ${QUOTE_PRODUCT} - run db:seed first`);

  // What quotes.spec converted last time. The order is linked back through
  // convertedOrderId and filed under the quote's address - both are checked,
  // so an order whose quote went first (SetNull) still goes.
  const converted = await prisma.order.deleteMany({
    where: {
      OR: [
        { convertedFrom: { is: { email: { startsWith: QUOTE_PREFIX } } } },
        { customer: { email: { startsWith: QUOTE_PREFIX } } },
      ],
    },
  });
  // their events cascade
  await prisma.bulkQuote.deleteMany({ where: { email: { startsWith: QUOTE_PREFIX } } });

  const customerId = async (email: string, name: string, company: string) =>
    (
      await prisma.customer.upsert({
        where: { email },
        update: { name, company },
        create: { email, name, company },
      })
    ).id;

  const now = Date.now();
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  await prisma.bulkQuote.create({
    data: {
      email: QUOTE_NEW_EMAIL,
      name: 'E2E New Lead',
      company: QUOTE_COMPANY,
      productId: product.id,
      quantity: 120,
      method: PrintMethod.DTG,
      message: 'Tournament tees for the whole league, one-colour front print.',
      estimated: new Prisma.Decimal('1368.00'),
      status: QuoteStatus.NEW,
      customerId: await customerId(QUOTE_NEW_EMAIL, 'E2E New Lead', QUOTE_COMPANY),
    },
  });

  await prisma.bulkQuote.create({
    data: {
      email: QUOTE_CONTACTED_EMAIL,
      name: 'E2E Contacted Lead',
      company: 'E2E Contacted Co',
      productId: product.id,
      quantity: 60,
      method: PrintMethod.SCREEN_PRINT,
      message: 'Staff shirts for the opening, need them in three weeks.',
      estimated: new Prisma.Decimal('684.00'),
      status: QuoteStatus.CONTACTED,
      assigneeId: staffId,
      // midnight UTC, like the follow-up picker writes; two days gone
      followUpAt: new Date(today.getTime() - 2 * DAY),
      createdAt: new Date(now - 5 * DAY),
      customerId: await customerId(QUOTE_CONTACTED_EMAIL, 'E2E Contacted Lead', 'E2E Contacted Co'),
      events: {
        create: {
          kind: QuoteEventKind.STATUS,
          status: QuoteStatus.CONTACTED,
          actorId: staffId,
          createdAt: new Date(now - 4 * DAY),
        },
      },
    },
  });

  await prisma.bulkQuote.create({
    data: {
      email: QUOTE_CONVERT_EMAIL,
      name: 'E2E Convert Lead',
      company: 'E2E Convert Co',
      productId: product.id,
      quantity: 48,
      method: PrintMethod.DTG,
      message: 'Ready to order - 24 M and 24 L.',
      estimated: new Prisma.Decimal('576.00'),
      status: QuoteStatus.NEW,
      createdAt: new Date(now - HOUR),
      customerId: await customerId(QUOTE_CONVERT_EMAIL, 'E2E Convert Lead', 'E2E Convert Co'),
    },
  });

  return converted.count;
}

// ----------------------------------------------------------------- reviews

async function seedReviews(productId: string) {
  await prisma.review.deleteMany({ where: { author: { startsWith: REVIEW_AUTHOR_PREFIX } } });

  const now = Date.now();
  const rows = [
    { author: 'E2E Pending Five', rating: 5, status: ReviewStatus.PENDING },
    { author: 'E2E Pending Four', rating: 4, status: ReviewStatus.PENDING },
    { author: 'E2E Pending Two', rating: 2, status: ReviewStatus.PENDING },
    { author: 'E2E Published', rating: 5, status: ReviewStatus.PUBLISHED },
    { author: 'E2E Rejected', rating: 1, status: ReviewStatus.REJECTED },
  ];

  await prisma.review.createMany({
    data: rows.map((r, i) => ({
      ...r,
      handle: 'E2E fixture',
      body: `Fixture review, ${r.rating} star${r.rating === 1 ? '' : 's'}, seeded ${r.status.toLowerCase()}.`,
      productId,
      moderatedAt: r.status === ReviewStatus.PENDING ? null : new Date(now),
      // a minute apart, so newest-first is a stable order
      createdAt: new Date(now - i * 60_000),
    })),
  });
}

// ----------------------------------------------------------------- catalog

/**
 * An archived product and colour the catalog tests may edit freely, reset to
 * exactly this every run - archived, so the storefront never lists either.
 */
async function seedCatalogFixtures() {
  const teal = { name: 'E2E Teal', hex: '#1A7F7A', dark: true, active: false, sortOrder: 999 };
  await prisma.color.upsert({
    where: { slug: TEST_COLOR },
    update: teal,
    create: { slug: TEST_COLOR, ...teal },
  });

  const blank = {
    name: 'E2E Test Blank',
    type: GarmentType.TEE,
    category: 'apparel',
    blurb: 'A blank that exists only for the back-office e2e suite.',
    fabric: '100% test cotton',
    tag: 'e2e',
    sizes: [],
    price: new Prisma.Decimal(20),
    bulkPrice: new Prisma.Decimal(9),
    methods: [PrintMethod.DTG],
    printAreaX: 204,
    printAreaY: 242,
    printAreaW: 192,
    printAreaH: 256,
    printInchesW: new Prisma.Decimal(12),
    printInchesH: new Prisma.Decimal(16),
    active: false,
    sortOrder: 999,
  };
  const product = await prisma.product.upsert({
    where: { slug: TEST_PRODUCT },
    update: blank,
    create: { slug: TEST_PRODUCT, ...blank },
  });

  await prisma.productColor.deleteMany({ where: { productId: product.id } });
  await prisma.productImage.deleteMany({ where: { productId: product.id } });
  for (const [sortOrder, slug] of ['white', 'black'].entries()) {
    const color = await prisma.color.findUnique({ where: { slug } });
    if (!color) throw new Error(`colour ${slug} is missing - run db:seed first`);
    await prisma.productColor.create({ data: { productId: product.id, colorId: color.id, sortOrder } });
  }

  const size = await prisma.size.deleteMany({ where: { code: TEST_SIZE } });
  return size.count;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
