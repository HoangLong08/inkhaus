import { STATS_RANGES, type StatsRange } from '@inkhaus/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { DateRangeDto } from '../../../common/dto/date-range.dto';

/**
 * `GET /admin/stats/overview`: a preset ending today, or an explicit
 * `from`/`to` pair of inclusive UTC days. When both arrive the explicit pair
 * wins - that is `resolveRange`'s rule, applied in the service, not something
 * this class decides. Neither means the last 30 days.
 */
export class StatsOverviewDto extends DateRangeDto {
  @ApiPropertyOptional({
    enum: STATS_RANGES,
    default: '30d',
    description: 'a preset ending today, today included',
  })
  @IsOptional()
  @IsIn([...STATS_RANGES])
  range?: StatsRange;
}
