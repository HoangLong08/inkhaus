/**
 * Extra fixtures the admin e2e suite needs, kept out of `seed.ts` so a real
 * deployment never grows a test account.
 *
 *   npm run db:seed:e2e -w @inkhaus/api
 *
 * Adds one STAFF account, which is what makes the role tests meaningful - the
 * bootstrap accounts are all OWNER, so without this there is nobody to be
 * refused. Also guarantees there is a PENDING_PAYMENT order to act on.
 */
// first, and before @prisma/client: DATABASE_URL comes from the repo-root .env
import '../src/load-env';

import { AdminRole, OrderStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const E2E_STAFF_EMAIL = 'e2e-staff@inkhaus.test';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('refusing to seed e2e fixtures into a production database');
  }

  await prisma.adminUser.upsert({
    where: { email: E2E_STAFF_EMAIL },
    update: { role: AdminRole.STAFF, isActive: true },
    create: { email: E2E_STAFF_EMAIL, name: 'E2E Staff', role: AdminRole.STAFF },
  });

  const actionable = await prisma.order.count({
    where: { status: OrderStatus.PENDING_PAYMENT },
  });

  console.log(
    [
      `  staff account   ${E2E_STAFF_EMAIL}`,
      `  actionable orders (PENDING_PAYMENT)  ${actionable}`,
      actionable === 0
        ? '  WARNING: no PENDING_PAYMENT order - the status tests will skip'
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
