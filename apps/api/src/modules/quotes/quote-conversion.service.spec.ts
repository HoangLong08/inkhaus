import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../../common/prisma/prisma.service';
import type { CustomersService } from '../customers/customers.service';
import type { OrderBuilderService, PricedItem } from '../orders/order-builder.service';
import {
  CONVERTED_ORDER_NOTE,
  DESIGN_NOT_THEIRS_MESSAGE,
  QuoteConversionService,
  type QuoteConversionInput,
} from './quote-conversion.service';

type QuoteRow = {
  email: string;
  name: string | null;
  company: string | null;
  status: string;
  customerId: string | null;
  convertedOrderId: string | null;
  convertedOrder: { number: string } | null;
};

const ACTOR = { id: 'admin-staff' };

const INPUT: QuoteConversionInput = {
  productSlug: 'heavyweight-tee',
  colorSlug: 'black',
  method: 'DTG',
  sizes: [
    { size: 'M', qty: 24 },
    { size: 'L', qty: 24 },
  ],
};

const PRICED: PricedItem[] = [
  {
    productId: 'prod-1',
    colorId: 'color-1',
    method: 'DTG',
    unitPrice: 12,
    quantity: 48,
    lineTotal: 576,
    sizes: [],
  },
];
const TOTALS = { subtotal: 576, shipping: 0, tax: 0, total: 576 };

/** a Prisma stand-in whose interactive transaction hands over the same stub */
function setup(
  row: Partial<QuoteRow> | null,
  claimed = 1,
  design: { customerId: string | null } | null = { customerId: null },
) {
  const tx = {
    bulkQuote: {
      findUnique: jest.fn().mockResolvedValue(
        row && {
          email: 'lead@inkhaus.test',
          name: 'Lead',
          company: 'Lead Co',
          status: 'NEW',
          customerId: 'cust-1',
          convertedOrderId: null,
          convertedOrder: null,
          ...row,
        },
      ),
      updateMany: jest.fn().mockResolvedValue({ count: claimed }),
    },
    design: { findUnique: jest.fn().mockResolvedValue(design) },
    quoteEvent: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = { ...tx, $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)) };
  const builder = {
    priceItems: jest.fn().mockResolvedValue(PRICED),
    totals: jest.fn().mockReturnValue(TOTALS),
    createOrder: jest.fn().mockResolvedValue({ id: 'order-1', number: 'INK-000123' }),
  };
  const customers = { findOrCreate: jest.fn().mockResolvedValue({ id: 'cust-new' }) };

  const service = new QuoteConversionService(
    prisma as unknown as PrismaService,
    builder as unknown as OrderBuilderService,
    customers as unknown as CustomersService,
  );
  const convert = (input: QuoteConversionInput = INPUT) => service.convert('quote-1', input, ACTOR);
  const newOrder = () => builder.createOrder.mock.calls[0][1];
  const events = () => tx.quoteEvent.createMany.mock.calls[0][0].data;

  return { tx, prisma, builder, customers, convert, newOrder, events };
}

describe('QuoteConversionService.convert', () => {
  it('creates a DRAFT order with no placedAt, priced by the builder, attributed to the actor', async () => {
    const { builder, convert, newOrder } = setup({});

    await expect(convert()).resolves.toEqual({ id: 'order-1', number: 'INK-000123' });

    // only slugs and quantities go to the builder - never a price from the quote
    expect(builder.priceItems).toHaveBeenCalledWith([
      { productSlug: 'heavyweight-tee', colorSlug: 'black', method: 'DTG', designId: undefined, sizes: INPUT.sizes },
    ]);
    expect(newOrder()).toMatchObject({
      customerId: 'cust-1',
      status: 'DRAFT',
      placedAt: null,
      priced: PRICED,
      totals: TOTALS,
      event: { status: 'DRAFT', note: CONVERTED_ORDER_NOTE, actorId: 'admin-staff' },
    });
  });

  it('claims the quote only while it is unconverted and as it was read, making it WON', async () => {
    const { tx, convert } = setup({ status: 'CONTACTED' });

    await convert();
    expect(tx.bulkQuote.updateMany).toHaveBeenCalledWith({
      where: { id: 'quote-1', status: 'CONTACTED', convertedOrderId: null },
      data: { status: 'WON', convertedOrderId: 'order-1', customerId: 'cust-1' },
    });
  });

  it('records CONVERTED with the order number, then the move to WON', async () => {
    const { convert, events } = setup({ status: 'NEW' });

    await convert();
    const [converted, status] = events();
    expect(converted).toMatchObject({
      quoteId: 'quote-1',
      kind: 'CONVERTED',
      note: 'INK-000123',
      actorId: 'admin-staff',
    });
    expect(status).toMatchObject({ kind: 'STATUS', status: 'WON', actorId: 'admin-staff' });
    expect(status.createdAt.getTime()).toBeGreaterThan(converted.createdAt.getTime());
  });

  it('adds no STATUS event for a quote that was already marked WON', async () => {
    const { convert, events } = setup({ status: 'WON' });

    await convert();
    expect(events()).toEqual([expect.objectContaining({ kind: 'CONVERTED' })]);
  });

  it('answers 409 for a quote that is already an order, before pricing or writing anything', async () => {
    const { builder, prisma, convert } = setup({
      status: 'WON',
      convertedOrderId: 'order-0',
      convertedOrder: { number: 'INK-000100' },
    });

    await expect(convert()).rejects.toThrow(new ConflictException('This quote is already order INK-000100.'));
    expect(builder.priceItems).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('answers 409 for a LOST quote', async () => {
    const { builder, convert } = setup({ status: 'LOST' });

    await expect(convert()).rejects.toThrow(ConflictException);
    expect(builder.createOrder).not.toHaveBeenCalled();
  });

  it('answers 409 when another conversion claimed the quote first, and records nothing', async () => {
    const { tx, builder, convert } = setup({}, 0);

    await expect(convert()).rejects.toThrow(ConflictException);
    // the order was created inside the transaction the throw rolls back
    expect(builder.createOrder).toHaveBeenCalledWith(tx, expect.anything());
    expect(tx.quoteEvent.createMany).not.toHaveBeenCalled();
  });

  it('files the order under the quote email when the quote has no customer yet, without rewriting one', async () => {
    const { customers, tx, convert, newOrder } = setup({ customerId: null });

    await convert();
    // create-only: an existing customer keeps whatever staff last saved on it
    expect(customers.findOrCreate).toHaveBeenCalledWith(
      'lead@inkhaus.test',
      { name: 'Lead', company: 'Lead Co' },
      { update: false },
    );
    expect(newOrder().customerId).toBe('cust-new');
    // and links the quote to that customer while it is at it
    expect(tx.bulkQuote.updateMany.mock.calls[0][0].data.customerId).toBe('cust-new');
  });

  it('keeps the quote customer when it has one', async () => {
    const { customers, convert } = setup({});

    await convert();
    expect(customers.findOrCreate).not.toHaveBeenCalled();
  });

  it("refuses another customer's design, before writing anything", async () => {
    const { prisma, builder, convert } = setup({}, 1, { customerId: 'cust-other' });

    await expect(convert({ ...INPUT, designId: 'k3m9xq2t7p' })).rejects.toThrow(
      new BadRequestException(DESIGN_NOT_THEIRS_MESSAGE),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(builder.createOrder).not.toHaveBeenCalled();
  });

  it.each([
    ["the customer's own", 'cust-1'],
    ['an ownerless', null],
  ])('accepts %s design', async (_label, owner) => {
    const { tx, newOrder, convert } = setup({}, 1, { customerId: owner });

    await expect(convert({ ...INPUT, designId: 'k3m9xq2t7p' })).resolves.toMatchObject({ number: 'INK-000123' });
    expect(tx.design.findUnique).toHaveBeenCalledWith({
      where: { publicId: 'k3m9xq2t7p' },
      select: { customerId: true },
    });
    expect(newOrder().customerId).toBe('cust-1');
  });

  it('checks the design against the customer the order is filed under', async () => {
    // a quote with no customer: the order goes to the customer found by email
    const { convert } = setup({ customerId: null }, 1, { customerId: 'cust-new' });
    await expect(convert({ ...INPUT, designId: 'k3m9xq2t7p' })).resolves.toMatchObject({ id: 'order-1' });
  });

  it('checks no design when none was chosen', async () => {
    const { tx, convert } = setup({});

    await convert();
    expect(tx.design.findUnique).not.toHaveBeenCalled();
  });

  it('answers 404 for a quote that does not exist', async () => {
    const { convert } = setup(null);
    await expect(convert()).rejects.toThrow(NotFoundException);
  });
});
