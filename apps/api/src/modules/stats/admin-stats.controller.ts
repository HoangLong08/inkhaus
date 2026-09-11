import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Can } from '../../common/decorators/can.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { StatsOverviewDto } from './dto/stats-overview.dto';
import { StatsService, type StatsOverview } from './stats.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/stats', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminStatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  @Can('stats.view')
  @ApiOperation({
    summary:
      'The overview - queues by status, revenue and a zero-filled daily series for a range (UTC days), top products, the quote funnel, and what needs attention',
  })
  overview(@Query() query: StatsOverviewDto): Promise<StatsOverview> {
    return this.stats.overview(query);
  }
}
