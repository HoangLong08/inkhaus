import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AdminUser } from '@prisma/client';

import { Can } from '../../common/decorators/can.decorator';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import {
  StaffService,
  type StaffDirectoryEntry,
  type StaffList,
  type StaffMember,
} from './staff.service';

/**
 * Staff accounts. Managing them is owner-only (`staff.view`, `staff.manage`);
 * the directory is not, because every role needs names for pickers.
 *
 * `admin_users` IS the sign-in allowlist, so everything here decides who can
 * get into the back office at all. The rules that keep the office from locking
 * itself out live in StaffService, not here: they need the rows as they are
 * inside a transaction, which no guard can see.
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

  @Get()
  @Can('staff.view')
  @ApiOperation({
    summary: 'Every staff account, active first, with sessions, inviter and the active-owner count',
  })
  list(@CurrentAdmin() admin: AdminUser): Promise<StaffList> {
    return this.staff.list(admin);
  }

  @Post()
  @Can('staff.manage')
  @ApiOperation({
    summary: 'Add a Google account to the allowlist - no email is sent; 409 if it is already there',
  })
  invite(@Body() body: InviteStaffDto, @CurrentAdmin() admin: AdminUser): Promise<StaffMember> {
    return this.staff.invite(admin, body);
  }

  @Patch(':id')
  @Can('staff.manage')
  @ApiOperation({
    summary:
      'Rename, change role, deactivate or reactivate. Never yourself (400), never the last active owner (409)',
  })
  update(
    @Param('id') id: string,
    @Body() body: UpdateStaffDto,
    @CurrentAdmin() admin: AdminUser,
  ): Promise<StaffMember> {
    return this.staff.update(admin, id, body);
  }

  @Delete(':id/sessions')
  @Can('staff.manage')
  @ApiOperation({ summary: 'Sign someone out everywhere; 400 for yourself - use sign-out' })
  revokeSessions(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminUser,
  ): Promise<{ revoked: number }> {
    return this.staff.revokeSessions(admin, id);
  }
}
