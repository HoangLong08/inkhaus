import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  adminOrderDetailInclude,
  PREVIEWABLE_IMAGE_PREFIXES,
  toAdminOrderDetail,
  type AdminOrderDetail,
  type AdminOrderRow,
  type PreviewSides,
} from './admin-order-detail.mapper';
import type { TrackingDto } from './dto/tracking.dto';
import type { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderWorkflowService, type WorkflowActor } from './order-workflow.service';

/**
 * The back-office view of one order - everything the public DTO leaves out:
 * staff notes, who did what, the customer record, per-size pricing. Every write
 * goes through OrderWorkflowService, never around it, and answers with the
 * order as it now stands so the page can replace its cache in one step.
 */
@Injectable()
export class AdminOrderDetailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: OrderWorkflowService,
  ) {}

  async get(number: string): Promise<AdminOrderDetail> {
    const order = await this.prisma.order.findUnique({
      where: { number },
      include: adminOrderDetailInclude,
    });
    if (!order) throw new NotFoundException(`No order "${number}"`);
    return toAdminOrderDetail(order, await this.previewSides(order));
  }

  /** never the same status twice here - that is the legacy route's note idiom */
  async changeStatus(number: string, dto: UpdateOrderStatusDto, actor: WorkflowActor) {
    await this.workflow.changeStatus(number, dto, actor, { allowSame: false });
    return this.get(number);
  }

  async addNote(number: string, note: string, actor: WorkflowActor) {
    await this.workflow.addNote(number, note, actor);
    return this.get(number);
  }

  async setTracking(number: string, dto: TrackingDto, actor: WorkflowActor) {
    await this.workflow.setTracking(number, dto, actor);
    return this.get(number);
  }

  /**
   * Which of the order's designs have a preview the admin can draw, per side.
   * Asked of the database rather than read off the rows: the previews are data
   * URLs, and loading them to test for null would pull megabytes of artwork
   * onto a page that only needs two booleans per line.
   */
  private async previewSides(order: AdminOrderRow): Promise<PreviewSides> {
    const ids = [...new Set(order.items.flatMap((i) => (i.design ? [i.design.id] : [])))];
    if (ids.length === 0) return { front: new Set(), back: new Set() };

    const [front, back] = await this.prisma.$transaction([
      this.prisma.design.findMany({
        where: {
          id: { in: ids },
          OR: PREVIEWABLE_IMAGE_PREFIXES.map((prefix) => ({ previewFront: { startsWith: prefix } })),
        },
        select: { id: true },
      }),
      this.prisma.design.findMany({
        where: {
          id: { in: ids },
          OR: PREVIEWABLE_IMAGE_PREFIXES.map((prefix) => ({ previewBack: { startsWith: prefix } })),
        },
        select: { id: true },
      }),
    ]);

    return { front: new Set(front.map((d) => d.id)), back: new Set(back.map((d) => d.id)) };
  }
}
