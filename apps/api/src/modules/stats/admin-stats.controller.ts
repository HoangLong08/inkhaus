import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Can } from '../../common/decorators/can.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { StatsService, type StatsOverview } from './stats.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/stats', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminStatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  @Can('stats.view')
  @ApiOperation({ summary: 'Overview counts - orders and quotes by status, reviews awaiting moderation' })
  overview(): Promise<StatsOverview> {
    return this.stats.overview();
  }
}
