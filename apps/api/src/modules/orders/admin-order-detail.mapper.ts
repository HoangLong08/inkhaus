import type { OrderEventKind, OrderStatus, PrintMethod, Prisma } from '@prisma/client';
import { SIZES } from '@inkhaus/shared';

import { num, round2 } from '../../common/decimal';
import { parseTrackingNote, toTracking, type Tracking } from './tracking';

/**
 * The only preview formats the admin's preview route decodes and serves
 * (`apps/admin/src/app/api/admin/designs/[publicId]/preview/[side]`). A design
 * whose preview is anything else reports no preview, rather than a broken
 * image on the one screen operators live in.
 */
export const PREVIEWABLE_IMAGE_PREFIXES = [
  'data:image/png;base64,',
  'data:image/jpeg;base64,',
  'data:image/webp;base64,',
] as const;

export const adminOrderDetailInclude = {
  customer: { select: { id: true, email: true, name: true, phone: true, company: true } },
  items: {
    orderBy: { id: 'asc' },
    include: {
      product: { select: { slug: true, name: true } },
      color: { select: { slug: true, name: true, hex: true } },
      // Never the previews themselves: they are data URLs that can run to
      // megabytes, and the page draws them through the preview route instead.
      // Whether each side exists is a separate, id-only query.
      design: { select: { id: true, publicId: true, name: true } },
      sizes: true,
    },
  },
  // every kind - the back office is the audience NOTE exists for
  events: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { actor: { select: { id: true, name: true, email: true } } },
  },
  convertedFrom: { select: { id: true } },
} satisfies Prisma.OrderInclude;

export type AdminOrderRow = Prisma.OrderGetPayload<{ include: typeof adminOrderDetailInclude }>;

/** internal design ids with a servable preview on each side */
export type PreviewSides = { front: ReadonlySet<string>; back: ReadonlySet<string> };

export type AdminOrderActor = { id: string; name: string | null; email: string };

export type AdminOrderEvent = {
  id: string;
  kind: OrderEventKind;
  /** the order's status when it happened - for STATUS, the one it moved into */
  status: OrderStatus;
  note: string | null;
  at: string;
  actor: AdminOrderActor | null;
  /** a TRACKING event's carrier, number and link; null for every other kind */
  tracking: Tracking | null;
};

export type AdminOrderSize = {
  size: string;
  qty: number;
  upcharge: number;
  /** the line's tier price plus this size's upcharge */
  unitPrice: number;
  lineTotal: number;
};

export type AdminOrderItem = {
  productSlug: string;
  productName: string;
  color: { slug: string; name: string; hex: string };
  method: PrintMethod;
  /** tier price for one unit, before size upcharges */
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  sizes: AdminOrderSize[];
  design: { publicId: string; name: string; hasFront: boolean; hasBack: boolean } | null;
};

/** GET /admin/orders/:number - the admin app parses exactly this shape */
export type AdminOrderDetail = {
  number: string;
  status: OrderStatus;
  currency: string;
  customer: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    company: string | null;
  };
  items: AdminOrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  shippingAddress: {
    name: string | null;
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postal: string | null;
    country: string | null;
  };
  /** what the customer wrote at checkout */
  notes: string | null;
  tracking: Tracking | null;
  /** oldest first, every kind */
  timeline: AdminOrderEvent[];
  /** the bulk quote this order was converted from */
  quote: { id: string } | null;
  placedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** the house size run first, in its own order; anything custom after, by name */
const SIZE_RANK = new Map<string, number>(SIZES.map((size, i) => [size, i]));
const bySizeRun = (a: { size: string }, b: { size: string }) =>
  (SIZE_RANK.get(a.size) ?? SIZES.length) - (SIZE_RANK.get(b.size) ?? SIZES.length) ||
  a.size.localeCompare(b.size);

const iso = (d: Date | null) => d?.toISOString() ?? null;

/**
 * The back-office view of one order. Pure, so the spec beside it can hold it up
 * against the public mapper (`toPublicOrder`) - this one carries staff notes,
 * who did what and the customer record; that one must carry none of it.
 */
export function toAdminOrderDetail(o: AdminOrderRow, previews: PreviewSides): AdminOrderDetail {
  return {
    number: o.number,
    status: o.status,
    currency: o.currency,
    customer: {
      id: o.customer.id,
      email: o.customer.email,
      name: o.customer.name,
      phone: o.customer.phone,
      company: o.customer.company,
    },
    items: o.items.map((i) => {
      const base = num(i.unitPrice);
      return {
        productSlug: i.product.slug,
        productName: i.product.name,
        color: { slug: i.color.slug, name: i.color.name, hex: i.color.hex },
        method: i.method,
        unitPrice: base,
        quantity: i.quantity,
        lineTotal: num(i.lineTotal),
        sizes: [...i.sizes].sort(bySizeRun).map((s) => {
          const upcharge = num(s.upcharge);
          const unitPrice = round2(base + upcharge);
          return {
            size: s.size,
            qty: s.quantity,
            upcharge,
            unitPrice,
            lineTotal: round2(unitPrice * s.quantity),
          };
        }),
        design: i.design
          ? {
              publicId: i.design.publicId,
              name: i.design.name,
              hasFront: previews.front.has(i.design.id),
              hasBack: previews.back.has(i.design.id),
            }
          : null,
      };
    }),
    subtotal: num(o.subtotal),
    discount: num(o.discount),
    shipping: num(o.shipping),
    tax: num(o.tax),
    total: num(o.total),
    shippingAddress: {
      name: o.shipName,
      line1: o.shipLine1,
      line2: o.shipLine2,
      city: o.shipCity,
      state: o.shipState,
      postal: o.shipPostal,
      country: o.shipCountry,
    },
    notes: o.notes,
    tracking: toTracking(o),
    timeline: o.events.map((e) => ({
      id: e.id,
      kind: e.kind,
      status: e.status,
      note: e.note,
      at: e.createdAt.toISOString(),
      actor: e.actor ? { id: e.actor.id, name: e.actor.name, email: e.actor.email } : null,
      tracking: e.kind === 'TRACKING' ? parseTrackingNote(e.note) : null,
    })),
    quote: o.convertedFrom ? { id: o.convertedFrom.id } : null,
    placedAt: iso(o.placedAt),
    shippedAt: iso(o.shippedAt),
    deliveredAt: iso(o.deliveredAt),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}
