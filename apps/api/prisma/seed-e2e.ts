/**
 * Extra fixtures the e2e suites need, kept out of `seed.ts` so a real
 * deployment never grows a test account.
 *
 *   npm run db:seed:e2e -w @inkhaus/api
 *
 * Adds one STAFF account, which is what makes the back office role tests
 * meaningful - the bootstrap accounts are all OWNER, so without this there is
 * nobody to be refused. Also guarantees there are PENDING_PAYMENT orders to act
 * on - the suite spends them and cannot put them back - and one order belonging
 * to the storefront's test shopper.
 *
 * That last fixture carries the claim the storefront account page makes: the
 * order is filed under the shopper's ADDRESS before that person has ever signed
 * in, exactly as a guest checkout leaves it. If /account can show it after a
 * first-ever sign-in, guest orders really do come with the account.
 */
// first, and before @prisma/client: DATABASE_URL comes from the repo-root .env
import '../src/load-env';

import { AdminRole, OrderStatus, PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export const E2E_STAFF_EMAIL = 'e2e-staff@inkhaus.test';
export const E2E_SHOPPER_EMAIL = 'e2e-shopper@inkhaus.test';
/** fixed, so a re-run updates the same row instead of stacking up orders */
const E2E_SHOPPER_ORDER = 'INK-900001';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('refusing to seed e2e fixtures into a production database');
  }

  await prisma.adminUser.upsert({
    where: { email: E2E_STAFF_EMAIL },
    update: { role: AdminRole.STAFF, isActive: true },
    create: { email: E2E_STAFF_EMAIL, name: 'E2E Staff', role: AdminRole.STAFF },
  });

  await seedShopperOrder();
  const actionable = await ensureActionableOrders();

  console.log(
    [
      `  staff account   ${E2E_STAFF_EMAIL}`,
      `  shopper account ${E2E_SHOPPER_EMAIL} with order ${E2E_SHOPPER_ORDER}`,
      `  actionable orders (PENDING_PAYMENT)  ${actionable}`,
      actionable < ACTIONABLE_NEEDED
        ? `  WARNING: fewer than ${ACTIONABLE_NEEDED} PENDING_PAYMENT orders - the status tests will fail`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

/**
 * How many the admin suite spends per run: one in `rbac.spec.ts` (staff advance
 * to PAID) and one in `ui.spec.ts` (the optimistic-update test), plus a spare.
 */
const ACTIONABLE_NEEDED = 3;

/**
 * Puts back what the suite spends.
 *
 * The status tests advance orders out of PENDING_PAYMENT and nothing moves them
 * back - the transition table has no route from PAID to PENDING_PAYMENT, which
 * is correct for the product and unhelpful for a fixture. `seed.ts` upserts
 * orders by number without touching their status, so the well ran dry after two
 * or three runs and the failure looked like "seed a PENDING_PAYMENT order
 * first", pointing at the seed that had in fact just run.
 *
 * Reaches past the API on purpose: this is the one place allowed to make a
 * transition the domain forbids, because it is resetting a fixture rather than
 * running a business. The shopper order is excluded - the storefront suite
 * asserts it is SHIPPED.
 */
async function ensureActionableOrders() {
  const have = await prisma.order.count({ where: { status: OrderStatus.PENDING_PAYMENT } });
  if (have >= ACTIONABLE_NEEDED) return have;

  const spent = await prisma.order.findMany({
    where: {
      number: { not: E2E_SHOPPER_ORDER },
      status: { not: OrderStatus.PENDING_PAYMENT },
    },
    orderBy: { createdAt: 'desc' },
    take: ACTIONABLE_NEEDED - have,
    select: { id: true },
  });

  await prisma.order.updateMany({
    where: { id: { in: spent.map((order) => order.id) } },
    data: { status: OrderStatus.PENDING_PAYMENT },
  });

  return prisma.order.count({ where: { status: OrderStatus.PENDING_PAYMENT } });
}

/**
 * One shipped order under the shopper's address, with no `googleSub` on the
 * customer row - the state a guest checkout leaves behind.
 *
 * Built straight through Prisma rather than through OrdersService: the numbers
 * here are a backdrop for an account page, and running them through the real
 * pricing ladder would make this fixture fail whenever a price changed, which
 * is a pricing test's job and not this one's.
 */
async function seedShopperOrder() {
  const pairing = await prisma.productColor.findFirst({
    orderBy: [{ productId: 'asc' }, { sortOrder: 'asc' }],
  });
  if (!pairing) {
    console.warn('  WARNING: no products seeded - run db:seed first; skipping shopper order');
    return;
  }

  const customer = await prisma.customer.upsert({
    where: { email: E2E_SHOPPER_EMAIL },
    update: {},
    create: { email: E2E_SHOPPER_EMAIL, name: 'E2E Shopper' },
  });

  // Rebuilt rather than updated: items and sizes hang off the order, and
  // deleting it cascades them away in one step.
  await prisma.order.deleteMany({ where: { number: E2E_SHOPPER_ORDER } });

  await prisma.order.create({
    data: {
      number: E2E_SHOPPER_ORDER,
      status: OrderStatus.SHIPPED,
      customerId: customer.id,
      subtotal: new Prisma.Decimal('84.00'),
      shipping: new Prisma.Decimal('0.00'),
      tax: new Prisma.Decimal('0.00'),
      total: new Prisma.Decimal('84.00'),
      shipName: 'E2E Shopper',
      shipLine1: '1 Test Street',
      shipCity: 'Charlotte',
      shipState: 'NC',
      shipPostal: '28202',
      shipCountry: 'US',
      placedAt: new Date('2026-08-01T10:00:00Z'),
      items: {
        create: {
          productId: pairing.productId,
          colorId: pairing.colorId,
          method: 'DTG',
          unitPrice: new Prisma.Decimal('14.00'),
          quantity: 6,
          lineTotal: new Prisma.Decimal('84.00'),
          sizes: { create: [{ size: 'M', quantity: 3 }, { size: 'L', quantity: 3 }] },
        },
      },
      events: {
        create: [
          { status: OrderStatus.PENDING_PAYMENT, note: 'Order placed' },
          { status: OrderStatus.SHIPPED, note: 'Handed to the carrier' },
        ],
      },
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
