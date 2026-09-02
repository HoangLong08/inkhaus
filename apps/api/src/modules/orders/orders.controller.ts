import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard, type AdminRequest } from '../../common/guards/admin-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller({ path: 'orders', version: '1' })
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Place an order - every price is recomputed server side' })
  create(@Body() dto: CreateOrderDto) {
    return this.orders.create(dto);
  }

  @Get(':number')
  @ApiOperation({ summary: 'Order status page lookup' })
  find(@Param('number') number: string) {
    return this.orders.findByNumber(number);
  }

  @Get()
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Back office order list' })
  list(@Query() query: ListOrdersDto) {
    return this.orders.list(query);
  }

  @Patch(':number/status')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Advance an order through production' })
  // No @Roles here: staff may run an order through production, but cancelling
  // and refunding are owner-only. That depends on the value in the body, not on
  // the route, so the service makes the call - see canSetStatus.
  updateStatus(
    @Param('number') number: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: AdminRequest,
  ) {
    return this.orders.updateStatus(number, dto, req.adminUser!.role);
  }
}
