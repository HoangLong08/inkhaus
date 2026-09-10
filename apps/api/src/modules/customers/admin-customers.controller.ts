import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { AdminCustomersService } from './admin-customers.service';

/** Customers in the back office - list, profile, edit. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/customers', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminCustomersController {
  constructor(private readonly customers: AdminCustomersService) {}
}
