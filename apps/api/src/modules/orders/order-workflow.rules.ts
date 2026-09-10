import {
  canSetStatus,
  canTransition,
  requiresTracking,
  type AdminRoleCode,
  type OrderStatusCode,
} from '@inkhaus/shared';

export type StatusChangeInput = {
  from: OrderStatusCode;
  to: OrderStatusCode;
  role: AdminRoleCode;
  /** whether re-sending the current status is a note rather than a mistake */
  allowSame: boolean;
  /** tracking sent with this change, or already on the order */
  hasTracking: boolean;
};

export type StatusChangeDecision =
  | { ok: true; kind: 'STATUS' | 'NOTE' }
  | { ok: false; status: 400 | 403; message: string };

/**
 * Whether a staff member may move an order from one status to another, and
 * what the timeline should call it. Pure, so every branch is a unit test rather
 * than a database fixture.
 *
 * The checks run in a fixed order, and the order is part of the contract:
 *
 * 1. the role (403). Cancelling and refunding move money, so they are
 *    owner-only - and checked first, so staff hear "you may not" rather than a
 *    confusing "cannot move from X to Y".
 * 2. staying put. The legacy route allowed it - it was how the old back office
 *    attached a note - so it is a NOTE there and a 400 everywhere else.
 * 3. the transition table (400), the same one the admin builds its dropdown
 *    from, so the two cannot disagree about what is a legal move.
 * 4. tracking (400). SHIPPED needs a carrier and a number, sent now or already
 *    on the order (decision D5).
 */
export function decideStatusChange(input: StatusChangeInput): StatusChangeDecision {
  const { from, to, role } = input;

  if (!canSetStatus(role, to)) {
    return { ok: false, status: 403, message: `Only an owner can move an order to ${to}` };
  }

  if (from === to) {
    return input.allowSame
      ? { ok: true, kind: 'NOTE' }
      : { ok: false, status: 400, message: `This order is already ${to}.` };
  }

  if (!canTransition(from, to)) {
    return { ok: false, status: 400, message: `Cannot move an order from ${from} to ${to}` };
  }

  if (requiresTracking(to) && !input.hasTracking) {
    return {
      ok: false,
      status: 400,
      message: 'Add a carrier and tracking number before marking this order shipped.',
    };
  }

  return { ok: true, kind: 'STATUS' };
}
