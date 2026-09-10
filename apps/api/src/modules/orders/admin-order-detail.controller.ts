import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { AdminOrderDetailService } from './admin-order-detail.service';

/**
 * One order in the back office: `admin/orders/:number` and what hangs off it.
 * Registered after AdminOrdersController, which owns the static paths under the
 * same prefix.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/orders', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminOrderDetailController {
  constructor(private readonly detail: AdminOrderDetailService) {}
}
