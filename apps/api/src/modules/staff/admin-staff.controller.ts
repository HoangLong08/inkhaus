import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Can } from '../../common/decorators/can.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { StaffService, type StaffDirectoryEntry } from './staff.service';

/**
 * Staff accounts. Managing them is owner-only (`staff.view`, `staff.manage`);
 * the directory is not, because every role needs names for pickers.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/staff', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminStaffController {
  constructor(private readonly staff: StaffService) {}

  /** declared first, so no later `:id` route can read "directory" as an id */
  @Get('directory')
  @Can('orders.view')
  @ApiOperation({ summary: 'Active staff - id, name, email and role - for assignee pickers' })
  directory(): Promise<StaffDirectoryEntry[]> {
    return this.staff.directory();
  }
}
