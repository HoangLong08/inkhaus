import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, type AdminUser } from '@prisma/client';

import type { AuditService } from '../../common/audit/audit.service';
import type { PrismaService } from '../../common/prisma/prisma.service';
import { AdminCatalogService, PRODUCT_CHANGED_MESSAGE } from './admin-catalog.service';
import type { PriceEditsPolicy } from './price-edits.policy';

const READ_AT = new Date('2026-09-10T08:00:00Z');
const OWNER = { id: 'admin-owner', role: 'OWNER' } as AdminUser;

/** the product as the transaction reads it: price 20, bulk 9 */
const ROW = {
  id: 'prod_1',
  slug: 'e2e-test-blank',
  name: 'E2E Test Blank',
  type: 'TEE',
  category: 'apparel',
  blurb: 'A blank for tests.',
  fabric: '100% test cotton',
  tag: null,
  sizes: [],
  price: new Prisma.Decimal(20),
  bulkPrice: new Prisma.Decimal(9),
  methods: ['DTG'],
  printAreaX: 204,
  printAreaY: 242,
  printAreaW: 192,
  printAreaH: 256,
  printInchesW: new Prisma.Decimal(12),
  printInchesH: new Prisma.Decimal(16),
  active: false,
  sortOrder: 999,
  createdAt: READ_AT,
  updatedAt: READ_AT,
  colors: [],
  images: [],
};

/** a Prisma stand-in whose interactive transaction hands over its own stub */
function setup(updated = 1) {
  const tx = {
    product: {
      findUnique: jest.fn().mockResolvedValue(ROW),
      updateMany: jest.fn().mockResolvedValue({ count: updated }),
    },
  };
  const prisma = {
    // the re-read after the write, for the response
    product: { findUnique: jest.fn().mockResolvedValue(ROW) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const audit = { record: jest.fn(), history: jest.fn().mockResolvedValue([]) };
  const priceEdits = { assertEnabled: jest.fn() };

  const service = new AdminCatalogService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    priceEdits as unknown as PriceEditsPolicy,
  );
  return { tx, audit, service };
}

describe('AdminCatalogService.update', () => {
  it('writes only while the product is still the version it read', async () => {
    const { tx, audit, service } = setup();

    await service.update(OWNER, 'e2e-test-blank', { name: 'Renamed Blank' });
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'prod_1', updatedAt: READ_AT },
      data: expect.objectContaining({ name: 'Renamed Blank', updatedAt: expect.any(Date) }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'product.update', after: { name: 'Renamed Blank' } }),
    );
  });

  it('answers 409 when someone else saved it first, and records nothing', async () => {
    const { audit, service } = setup(0);

    await expect(service.update(OWNER, 'e2e-test-blank', { bulkPrice: 15 })).rejects.toThrow(
      new ConflictException(PRODUCT_CHANGED_MESSAGE),
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('checks the bulk price against the stored price before writing', async () => {
    const { tx, service } = setup();

    await expect(service.update(OWNER, 'e2e-test-blank', { price: 8 })).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it('writes nothing for a save that changes nothing', async () => {
    const { tx, audit, service } = setup();

    await service.update(OWNER, 'e2e-test-blank', { name: 'E2E Test Blank' });
    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
