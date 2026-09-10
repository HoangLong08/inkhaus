import { Module } from '@nestjs/common';

import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AdminStatsController } from './admin-stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminStatsController],
  providers: [StatsService],
})
export class StatsModule {}
