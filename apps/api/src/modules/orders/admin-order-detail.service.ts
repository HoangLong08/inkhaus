import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { OrderWorkflowService } from './order-workflow.service';

/**
 * The back-office view of one order - everything the public DTO leaves out:
 * staff notes, who did what, the customer record, per-size pricing. Status
 * moves go through OrderWorkflowService, never around it.
 */
@Injectable()
export class AdminOrderDetailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: OrderWorkflowService,
  ) {}
}
