import { ORDER_STATUSES, type AdminRoleCode, type OrderStatusCode } from '@inkhaus/shared';

import { acceptsTracking, decideStatusChange, type StatusChangeInput } from './order-workflow.rules';

const move = (
  from: OrderStatusCode,
  to: OrderStatusCode,
  role: AdminRoleCode = 'OWNER',
  extra: Partial<StatusChangeInput> = {},
) => decideStatusChange({ from, to, role, allowSame: false, hasTracking: false, ...extra });

describe('decideStatusChange', () => {
  it.each<[OrderStatusCode, OrderStatusCode]>([
    ['PAID', 'CANCELLED'],
    ['DELIVERED', 'REFUNDED'],
  ])('keeps %s -> %s to owners', (from, to) => {
    expect(move(from, to, 'STAFF')).toEqual({
      ok: false,
      status: 403,
      message: `Only an owner can move an order to ${to}`,
    });
    expect(move(from, to, 'OWNER')).toEqual({ ok: true, kind: 'STATUS' });
  });

  it('checks the role before the transition table', () => {
    // illegal for anyone, but staff are told "owner" rather than "cannot move"
    expect(move('PENDING_PAYMENT', 'REFUNDED', 'STAFF')).toMatchObject({ ok: false, status: 403 });
    expect(move('PENDING_PAYMENT', 'REFUNDED', 'OWNER')).toMatchObject({ ok: false, status: 400 });
  });

  it('refuses a move the transition table does not allow', () => {
    expect(move('PENDING_PAYMENT', 'SHIPPED', 'OWNER', { hasTracking: true })).toEqual({
      ok: false,
      status: 400,
      message: 'Cannot move an order from PENDING_PAYMENT to SHIPPED',
    });
    expect(move('CANCELLED', 'PAID')).toMatchObject({ ok: false, status: 400 });
  });

  it('lets staff run an order through production', () => {
    expect(move('PENDING_PAYMENT', 'PAID', 'STAFF')).toEqual({ ok: true, kind: 'STATUS' });
    expect(move('PAID', 'IN_PRODUCTION', 'STAFF')).toEqual({ ok: true, kind: 'STATUS' });
    expect(move('SHIPPED', 'DELIVERED', 'STAFF')).toEqual({ ok: true, kind: 'STATUS' });
  });

  it('treats staying put as a 400, or as a note where the caller allows it', () => {
    expect(move('PAID', 'PAID')).toEqual({
      ok: false,
      status: 400,
      message: 'This order is already PAID.',
    });
    expect(move('PAID', 'PAID', 'STAFF', { allowSame: true })).toEqual({ ok: true, kind: 'NOTE' });
  });

  it('will not mark an order shipped without tracking', () => {
    expect(move('IN_PRODUCTION', 'SHIPPED', 'STAFF')).toEqual({
      ok: false,
      status: 400,
      message: 'Add a carrier and tracking number before marking this order shipped.',
    });
    // whether it came with the request or was already on the order is the
    // service's business; either way the rule only sees hasTracking
    expect(move('IN_PRODUCTION', 'SHIPPED', 'STAFF', { hasTracking: true })).toEqual({
      ok: true,
      kind: 'STATUS',
    });
  });

  it('takes tracking only where there is a parcel to track', () => {
    const refused = { ok: false, status: 400 };
    // nothing has been printed yet, let alone posted
    expect(move('PENDING_PAYMENT', 'PAID', 'STAFF', { sendsTracking: true })).toMatchObject(refused);
    expect(move('DRAFT', 'CANCELLED', 'OWNER', { sendsTracking: true })).toMatchObject(refused);
    expect(move('IN_PRODUCTION', 'CANCELLED', 'OWNER', { sendsTracking: true })).toMatchObject(refused);

    expect(
      move('IN_PRODUCTION', 'SHIPPED', 'STAFF', { sendsTracking: true, hasTracking: true }),
    ).toEqual({ ok: true, kind: 'STATUS' });
    expect(move('PAID', 'IN_PRODUCTION', 'STAFF', { sendsTracking: true })).toEqual({
      ok: true,
      kind: 'STATUS',
    });
    expect(move('SHIPPED', 'DELIVERED', 'STAFF', { sendsTracking: true })).toEqual({
      ok: true,
      kind: 'STATUS',
    });
  });

  it('applies the tracking rule to a legacy same-status note too', () => {
    expect(move('PAID', 'PAID', 'STAFF', { allowSame: true, sendsTracking: true })).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(
      move('IN_PRODUCTION', 'IN_PRODUCTION', 'STAFF', {
        allowSame: true,
        sendsTracking: true,
        hasTracking: true,
      }),
    ).toEqual({ ok: true, kind: 'NOTE' });
  });

  it.each(ORDER_STATUSES)('accepts tracking with %s exactly where SHIPPED needs it or it is editable', (to) => {
    expect(acceptsTracking(to)).toBe(['IN_PRODUCTION', 'SHIPPED', 'DELIVERED'].includes(to));
  });
});
