import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AdminUser } from '@prisma/client';

import { Can } from '../../common/decorators/can.decorator';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { AdminOrderDetailService } from './admin-order-detail.service';
import { AddOrderNoteDto } from './dto/add-order-note.dto';
import { OrderNumberParamsDto } from './dto/order-number.params';
import { TrackingDto } from './dto/tracking.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import type { WorkflowActor } from './order-workflow.service';

const actorOf = (admin: AdminUser): WorkflowActor => ({ id: admin.id, role: admin.role });

/**
 * One order in the back office: `admin/orders/:number` and what hangs off it.
 * Registered after AdminOrdersController, which owns the static paths under the
 * same prefix. Every write answers with the whole detail, so the page swaps its
 * cache entry for the server's version in one step.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/orders', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminOrderDetailController {
  constructor(private readonly detail: AdminOrderDetailService) {}

  @Get(':number')
  @Can('orders.view')
  @ApiOperation({
    summary: 'One order with internal notes, who did what, per-size pricing and the customer',
  })
  get(@Param() params: OrderNumberParamsDto) {
    return this.detail.get(params.number);
  }

  @Patch(':number/status')
  // The floor, not the whole rule: cancelling and refunding are owner-only, and
  // that depends on the status in the body, so the workflow checks canSetStatus.
  @Can('orders.advance')
  @ApiOperation({ summary: 'Move an order on - SHIPPED needs tracking, sent now or already on it' })
  setStatus(
    @Param() params: OrderNumberParamsDto,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentAdmin() admin: AdminUser,
  ) {
    return this.detail.changeStatus(params.number, dto, actorOf(admin));
  }

  @Post(':number/notes')
  @Can('orders.note')
  @ApiOperation({ summary: 'Add an internal note - staff only, never shown to the customer' })
  addNote(
    @Param() params: OrderNumberParamsDto,
    @Body() dto: AddOrderNoteDto,
    @CurrentAdmin() admin: AdminUser,
  ) {
    return this.detail.addNote(params.number, dto.note, actorOf(admin));
  }

  @Put(':number/tracking')
  @Can('orders.tracking')
  @ApiOperation({
    summary: 'Add or correct tracking without moving the order - in production, shipped or delivered',
  })
  setTracking(
    @Param() params: OrderNumberParamsDto,
    @Body() dto: TrackingDto,
    @CurrentAdmin() admin: AdminUser,
  ) {
    return this.detail.setTracking(params.number, dto, actorOf(admin));
  }
}
