import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderEventKind, OrderStatus, type AdminRole, type Prisma } from '@prisma/client';
import { canEditTracking, ORDER_INTERNAL_NOTE_MAX } from '@inkhaus/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { decideStatusChange } from './order-workflow.rules';
import { parseTracking, trackingNote, type TrackingInput } from './tracking';

export type StatusChange = {
  status: OrderStatus;
  /** shown on the timeline beside the move */
  note?: string | null;
  tracking?: TrackingInput | null;
};

export type WorkflowActor = { id: string; role: AdminRole };

export type StatusChangeResult = {
  id: string;
  number: string;
  status: OrderStatus;
  /** STATUS for a move, NOTE when the order stayed where it was */
  kind: 'STATUS' | 'NOTE';
};

export type TrackingChangeResult = {
  id: string;
  number: string;
  /** false when the order already carried exactly this tracking */
  changed: boolean;
};

export const ORDER_CHANGED_MESSAGE =
  'This order changed while you were looking at it. Reload and try again.';

/**
 * Every write to an order's own history - a status move, tracking, a staff
 * note - whichever route a request came in on, so each is checked, recorded
 * and attributed the same way. Returns what changed rather than the row: every
 * caller re-reads the order through its own mapper, and the public one must
 * never see what the admin one does.
 */
@Injectable()
export class OrderWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Moves an order to another status. The only code that does.
   *
   * One interactive transaction: read, decide, then an `updateMany` that only
   * matches while the order is still in the status that was read. Two people
   * advancing the same order both pass the checks on what they read, but only
   * one update can match - the other gets a 409 instead of writing a second
   * transition over the first (bug 5, decision D4).
   *
   * `allowSame` is for the legacy route, where re-sending the current status
   * was how the old back office attached a note; it becomes an internal NOTE.
   * Everywhere else staying put is a 400.
   */
  async changeStatus(
    number: string,
    change: StatusChange,
    actor: WorkflowActor,
    { allowSame }: { allowSame: boolean },
  ): Promise<StatusChangeResult> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { number },
        select: { id: true, status: true, carrier: true, trackingNumber: true, placedAt: true },
      });
      if (!order) throw new NotFoundException(`No order "${number}"`);

      const tracking = change.tracking ? parseTracking(change.tracking) : null;

      const decision = decideStatusChange({
        from: order.status,
        to: change.status,
        role: actor.role,
        allowSame,
        hasTracking: Boolean(tracking || (order.carrier && order.trackingNumber)),
      });
      if (!decision.ok) {
        throw decision.status === 403
          ? new ForbiddenException(decision.message)
          : new BadRequestException(decision.message);
      }

      const now = new Date();
      const moved = decision.kind === 'STATUS';
      const data: Prisma.OrderUpdateManyMutationInput = {
        status: change.status,
        ...(tracking ? { carrier: tracking.carrier, trackingNumber: tracking.number } : {}),
        ...(moved && change.status === OrderStatus.SHIPPED ? { shippedAt: now } : {}),
        ...(moved && change.status === OrderStatus.DELIVERED ? { deliveredAt: now } : {}),
        // a DRAFT has no placedAt; the first move out of DRAFT is when it was placed
        ...(moved && order.status === OrderStatus.DRAFT ? { placedAt: order.placedAt ?? now } : {}),
      };

      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data,
      });
      if (count === 0) throw new ConflictException(ORDER_CHANGED_MESSAGE);

      const events: Prisma.OrderEventCreateManyInput[] = [
        {
          orderId: order.id,
          kind: decision.kind,
          status: change.status,
          note: change.note?.trim() || null,
          actorId: actor.id,
          createdAt: now,
        },
      ];
      if (tracking) {
        events.push({
          orderId: order.id,
          kind: OrderEventKind.TRACKING,
          status: change.status,
          note: trackingNote(tracking),
          actorId: actor.id,
          // a millisecond later, so a timeline ordered by createdAt always reads
          // "Shipped" and then the tracking number, never the other way round
          createdAt: new Date(now.getTime() + 1),
        });
      }
      await tx.orderEvent.createMany({ data: events });

      return { id: order.id, number, status: change.status, kind: decision.kind };
    });
  }

  /**
   * Adds or corrects tracking without moving the order - the label was bought
   * while it was still on the press, or the number had a typo. Same shape as
   * changeStatus: one transaction, and the write only lands while the order is
   * still in the status that was read, so tracking cannot be written onto an
   * order someone cancelled a moment ago.
   *
   * Sending the tracking the order already has changes nothing and records
   * nothing. The route is a PUT, and a timeline that said "UPS 1Z…" twice would
   * read as two parcels.
   */
  async setTracking(
    number: string,
    input: TrackingInput,
    actor: WorkflowActor,
  ): Promise<TrackingChangeResult> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { number },
        select: { id: true, status: true, carrier: true, trackingNumber: true },
      });
      if (!order) throw new NotFoundException(`No order "${number}"`);

      if (!canEditTracking(order.status)) {
        throw new BadRequestException(
          `Tracking can be added once an order is in production. This one is ${order.status}.`,
        );
      }

      const tracking = parseTracking(input);
      if (order.carrier === tracking.carrier && order.trackingNumber === tracking.number) {
        return { id: order.id, number, changed: false };
      }

      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { carrier: tracking.carrier, trackingNumber: tracking.number },
      });
      if (count === 0) throw new ConflictException(ORDER_CHANGED_MESSAGE);

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          kind: OrderEventKind.TRACKING,
          status: order.status,
          note: trackingNote(tracking),
          actorId: actor.id,
        },
      });

      return { id: order.id, number, changed: true };
    });
  }

  /**
   * Staff talking to staff. The NOTE is filed under the order's status at the
   * time, for context only: nothing about a note depends on the status, so
   * there is no race to lose and no conditional write. It never reaches the
   * customer - the public mapper drops the kind entirely (decision D3).
   *
   * The DTO trims and limits the note already; this checks again because the
   * workflow does not assume any caller ran a ValidationPipe.
   */
  async addNote(number: string, note: string, actor: WorkflowActor) {
    const text = note.trim();
    if (!text) throw new BadRequestException('Write something in the note first.');
    if (text.length > ORDER_INTERNAL_NOTE_MAX) {
      throw new BadRequestException(
        `Keep an internal note to ${ORDER_INTERNAL_NOTE_MAX} characters or fewer.`,
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { number },
      select: { id: true, status: true },
    });
    if (!order) throw new NotFoundException(`No order "${number}"`);

    await this.prisma.orderEvent.create({
      data: {
        orderId: order.id,
        kind: OrderEventKind.NOTE,
        status: order.status,
        note: text,
        actorId: actor.id,
      },
    });

    return { id: order.id, number };
  }
}
