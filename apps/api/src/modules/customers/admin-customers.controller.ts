import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AdminUser } from '@prisma/client';

import { Can } from '../../common/decorators/can.decorator';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { AdminCustomersService } from './admin-customers.service';
import { AdminListCustomersDto } from './dto/admin-list-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

/** Customers in the back office - list, profile, edit. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/customers', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminCustomersController {
  constructor(private readonly customers: AdminCustomersService) {}

  @Get()
  @Can('customers.view')
  @ApiOperation({
    summary: 'Customer list - search by email, name, company or phone; order count and lifetime value per row',
  })
  list(@Query() query: AdminListCustomersDto) {
    return this.customers.list(query);
  }

  @Get(':id')
  @Can('customers.view')
  @ApiOperation({ summary: 'One customer - totals, the staff note, recent orders and quotes' })
  detail(@Param('id') id: string) {
    return this.customers.detail(id);
  }

  @Patch(':id')
  @Can('customers.edit')
  @ApiOperation({ summary: 'Edit name, phone, company or the staff note. Email cannot change. Audited.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentAdmin() admin: AdminUser,
  ) {
    return this.customers.update(id, dto, admin);
  }
}
