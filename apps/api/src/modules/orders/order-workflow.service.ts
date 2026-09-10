import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderEventKind, OrderStatus, type AdminRole, type Prisma } from '@prisma/client';

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

export const ORDER_CHANGED_MESSAGE =
  'This order changed while you were looking at it. Reload and try again.';

@Injectable()
export class OrderWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Moves an order to another status. The only code that does, whichever route
   * a request came in on, so every move is checked, recorded and attributed the
   * same way.
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
   *
   * Returns what changed rather than the row: every caller re-reads the order
   * through its own mapper, and the public one must never see what the admin
   * one does.
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
}
