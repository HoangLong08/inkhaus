import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Can } from '../../common/decorators/can.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { AdminOrdersService } from './admin-orders.service';
import { AdminListOrdersDto } from './dto/admin-list-orders.dto';

/**
 * The back-office order list. Shares `admin/orders` with
 * AdminOrderDetailController, which owns the `:number` routes - any static
 * path added here must stay in this controller, registered first, or `:number`
 * would swallow it.
 *
 * The CSV of this same list lives on AdminOrderExportController, under
 * `admin/exports`, so it sits apart from these paths altogether.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/orders', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  @Can('orders.view')
  @ApiOperation({
    summary:
      'Order list - search by number, email or name; filter by status, placed day (drafts by created day) or customer; sort; page',
  })
  list(@Query() query: AdminListOrdersDto) {
    return this.orders.list(query);
  }
}
