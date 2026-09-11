import { OrderStatus, Prisma } from '@prisma/client';

import { csvRow } from '../../common/csv';
import {
  exportFilename,
  exportSummary,
  ORDER_EXPORT_COLUMNS,
  ORDER_EXPORT_HEAD,
  ORDER_EXPORT_MAX,
  orderCsv,
  toCsvRecord,
  type OrderExportRow,
} from './admin-order-export.csv';

const row = (overrides: Partial<OrderExportRow> = {}): OrderExportRow => ({
  id: 'ckzorder0000000000000000001',
  number: 'INK-900004',
  status: OrderStatus.DELIVERED,
  placedAt: new Date('2026-08-15T12:00:00Z'),
  subtotal: new Prisma.Decimal('230.40'),
  discount: new Prisma.Decimal('0'),
  shipping: new Prisma.Decimal('8.00'),
  tax: new Prisma.Decimal('0'),
  total: new Prisma.Decimal('238.40'),
  currency: 'USD',
  carrier: 'UPS',
  trackingNumber: '1Z999AA10123456784',
  shipCity: 'Denver',
  shipState: 'CO',
  shipCountry: 'US',
  customer: { email: 'e2e-customer@inkhaus.test', name: 'E2E Customer' },
  items: [{ quantity: 6 }, { quantity: 6 }],
  ...overrides,
});

describe('ORDER_EXPORT_HEAD', () => {
  it('is a byte-order mark and the header row', () => {
    expect(ORDER_EXPORT_HEAD.charCodeAt(0)).toBe(0xfeff);
    expect(ORDER_EXPORT_HEAD.slice(1)).toBe(
      'number,status,placed_at,customer_email,customer_name,units,subtotal,discount,shipping,tax,total,currency,carrier,tracking_number,ship_city,ship_state,ship_country\r\n',
    );
  });
});

describe('toCsvRecord', () => {
  it('has one cell per column', () => {
    expect(toCsvRecord(row())).toHaveLength(ORDER_EXPORT_COLUMNS.length);
  });

  it('writes an order as its line', () => {
    expect(csvRow(toCsvRecord(row()))).toBe(
      'INK-900004,DELIVERED,2026-08-15T12:00:00.000Z,e2e-customer@inkhaus.test,E2E Customer,12,230.4,0,8,0,238.4,USD,UPS,1Z999AA10123456784,Denver,CO,US\r\n',
    );
  });

  it('leaves the blanks a draft has blank', () => {
    const cells = toCsvRecord(
      row({
        status: OrderStatus.DRAFT,
        placedAt: null,
        carrier: null,
        trackingNumber: null,
        customer: { email: 'draft@inkhaus.test', name: null },
      }),
    );
    expect(csvRow(cells)).toMatch(/^INK-900004,DRAFT,,draft@inkhaus\.test,,12,/);
  });

  it('defuses a customer-typed formula and quotes a comma', () => {
    const line = csvRow(
      toCsvRecord(
        row({
          customer: { email: 'x@inkhaus.test', name: '=HYPERLINK("http://evil","click")' },
          shipCity: 'Washington, D.C.',
        }),
      ),
    );
    expect(line).toContain(`"'=HYPERLINK(""http://evil"",""click"")"`);
    expect(line).toContain('"Washington, D.C."');
  });

  it('keeps money a number, never a string a spreadsheet would treat as text', () => {
    const cells = toCsvRecord(row({ total: new Prisma.Decimal('1234.56') }));
    expect(cells[ORDER_EXPORT_COLUMNS.indexOf('total')]).toBe(1234.56);
  });
});

describe('orderCsv', () => {
  const ids = Array.from({ length: 1203 }, (_, i) => `id${i}`);

  /** a batch as Postgres might return it: reordered, and missing one that was deleted */
  const shuffledLoad = (gone: string) =>
    jest.fn(async (batch: string[]) =>
      [...batch]
        .reverse()
        .filter((id) => id !== gone)
        .map((id) => row({ id, number: id })),
    );

  it('reads 500 at a time, only when asked, and writes rows in list order', async () => {
    const load = shuffledLoad('id7');
    const file = orderCsv(ids, load);

    const head = await file.next();
    expect(head.value).toBe(ORDER_EXPORT_HEAD);
    // nothing read yet: a batch is loaded when the stream wants the next chunk
    expect(load).not.toHaveBeenCalled();

    const chunks: string[] = [];
    for await (const chunk of file) chunks.push(chunk);

    expect(load.mock.calls.map(([batch]) => batch.length)).toEqual([500, 500, 203]);
    expect(load.mock.calls[1][0][0]).toBe('id500');
    const numbers = chunks
      .join('')
      .trimEnd()
      .split('\r\n')
      .map((line) => line.split(',')[0]);
    expect(numbers).toEqual(ids.filter((id) => id !== 'id7'));
  });

  it('is the head alone when nothing matched', async () => {
    const load = jest.fn();
    const chunks: string[] = [];
    for await (const chunk of orderCsv([], load)) chunks.push(chunk);
    expect(chunks).toEqual([ORDER_EXPORT_HEAD]);
    expect(load).not.toHaveBeenCalled();
  });
});

describe('exportSummary', () => {
  it('counts the rows and lists the filters', () => {
    expect(exportSummary(3, 3, 'placed_desc', { status: 'PAID' })).toBe('3 rows, filters: status=PAID');
    expect(exportSummary(1, 1, 'placed_desc', { q: '900002' })).toBe('1 row, filters: q="900002"');
  });

  it('says when the file was capped, and by which sort', () => {
    expect(exportSummary(ORDER_EXPORT_MAX, 12_345, 'total_desc', {})).toBe(
      '10000 of 12345 rows (capped, total_desc), filters: none',
    );
  });

  it('is not capped at exactly the limit', () => {
    expect(exportSummary(ORDER_EXPORT_MAX, ORDER_EXPORT_MAX, 'placed_desc', {})).toBe(
      '10000 rows, filters: none',
    );
  });
});

describe('exportFilename', () => {
  it('names the file after the UTC day', () => {
    expect(exportFilename(new Date('2026-09-11T23:30:00Z'))).toBe('orders-20260911.csv');
  });
});
