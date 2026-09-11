import type { OrderSort } from '@inkhaus/shared';
import type { Prisma } from '@prisma/client';

import { csvRow } from '../../common/csv';
import { isoDay } from '../../common/date-range';
import { num } from '../../common/decimal';
import { describeFilter, type OrderListFilter } from './admin-orders.query';

/**
 * The most rows one export carries. The file is personal data in bulk, and a
 * spreadsheet past this size is a reporting job, not a download. Past it the
 * response says so in `X-Export-Truncated`.
 */
export const ORDER_EXPORT_MAX = 10_000;

/** rows read per query while the file streams */
export const ORDER_EXPORT_BATCH = 500;

export const ORDER_EXPORT_COLUMNS = [
  'number',
  'status',
  'placed_at',
  'customer_email',
  'customer_name',
  'units',
  'subtotal',
  'discount',
  'shipping',
  'tax',
  'total',
  'currency',
  'carrier',
  'tracking_number',
  'ship_city',
  'ship_state',
  'ship_country',
] as const;

/**
 * The first chunk of the file: a UTF-8 byte-order mark, then the header row.
 * Excel opens a CSV without one in the machine's legacy code page, and a
 * customer called José arrives as "JosÃ©"; the mark is how it knows better.
 * Sheets and Numbers ignore it.
 */
export const ORDER_EXPORT_HEAD = String.fromCharCode(0xfeff) + csvRow(ORDER_EXPORT_COLUMNS);

/** exactly the columns above, and `id` to put a batch back in list order */
export const orderExportSelect = {
  id: true,
  number: true,
  status: true,
  placedAt: true,
  subtotal: true,
  discount: true,
  shipping: true,
  tax: true,
  total: true,
  currency: true,
  carrier: true,
  trackingNumber: true,
  shipCity: true,
  shipState: true,
  shipCountry: true,
  customer: { select: { email: true, name: true } },
  items: { select: { quantity: true } },
} satisfies Prisma.OrderSelect;

export type OrderExportRow = Prisma.OrderGetPayload<{ select: typeof orderExportSelect }>;

/**
 * One order as its cells, in ORDER_EXPORT_COLUMNS order. Escaping - quoting and
 * the formula guard - is `csvRow`'s job, so this stays a plain mapping. Money
 * goes out as numbers, which a spreadsheet can sum and which the formula guard
 * leaves alone; a draft's missing placed_at is an empty cell.
 */
export function toCsvRecord(o: OrderExportRow): unknown[] {
  return [
    o.number,
    o.status,
    o.placedAt,
    o.customer.email,
    o.customer.name,
    o.items.reduce((n, item) => n + item.quantity, 0),
    num(o.subtotal),
    num(o.discount),
    num(o.shipping),
    num(o.tax),
    num(o.total),
    o.currency,
    o.carrier,
    o.trackingNumber,
    o.shipCity,
    o.shipState,
    o.shipCountry,
  ];
}

/**
 * The file as chunks: the head, then one chunk per ORDER_EXPORT_BATCH ids.
 *
 * `load` reads one batch of orders by id. It is passed in so that the part
 * deciding what the file says is testable without a database, and it is called
 * only when the stream asks for the next chunk - a slow download never holds
 * more than one batch.
 *
 * `IN (...)` comes back in whatever order Postgres likes; `ids` is already in
 * list order, so that is what gets walked. An order deleted since it was picked
 * is simply not there.
 */
export async function* orderCsv(
  ids: readonly string[],
  load: (batch: string[]) => Promise<OrderExportRow[]>,
): AsyncGenerator<string> {
  yield ORDER_EXPORT_HEAD;

  for (let i = 0; i < ids.length; i += ORDER_EXPORT_BATCH) {
    const batch = ids.slice(i, i + ORDER_EXPORT_BATCH);
    const byId = new Map((await load(batch)).map((row) => [row.id, row]));
    let chunk = '';
    for (const id of batch) {
      const row = byId.get(id);
      if (row) chunk += csvRow(toCsvRecord(row));
    }
    if (chunk) yield chunk;
  }
}

/**
 * The audit log's line for one export. A capped one names the sort as well,
 * because then the sort decided which orders made it into the file.
 */
export function exportSummary(
  rows: number,
  total: number,
  sort: OrderSort,
  filter: OrderListFilter,
): string {
  const filters = `filters: ${describeFilter(filter)}`;
  return total > ORDER_EXPORT_MAX
    ? `${rows} of ${total} rows (capped, ${sort}), ${filters}`
    : `${rows} ${rows === 1 ? 'row' : 'rows'}, ${filters}`;
}

/** `orders-20260911.csv`, after the UTC day it was taken */
export function exportFilename(now: Date) {
  return `orders-${isoDay(now).replaceAll('-', '')}.csv`;
}
