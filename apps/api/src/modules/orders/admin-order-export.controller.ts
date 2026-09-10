import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { AdminOrdersService } from './admin-orders.service';

/**
 * Bulk exports of personal data. Owner-only (`orders.export`) and always
 * audited (decision D6); every row goes through `csvCell` in common/csv.ts.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/exports', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminOrderExportController {
  constructor(private readonly orders: AdminOrdersService) {}
}
