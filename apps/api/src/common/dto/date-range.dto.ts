import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, Matches } from 'class-validator';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `from` / `to` as a URL carries them: calendar days, YYYY-MM-DD, both
 * inclusive, UTC (decision D8). Only the shape is checked here; `resolveRange`
 * in common/date-range.ts turns them into a query interval and refuses inverted
 * or oversized ranges.
 *
 * Combine with other query params through `IntersectionType` from
 * @nestjs/swagger, which carries the validation metadata across:
 *
 *   export class ListThingsDto extends IntersectionType(PaginationDto, DateRangeDto) {}
 */
export class DateRangeDto {
  @ApiPropertyOptional({ example: '2026-08-01', description: 'first day, inclusive, UTC' })
  @IsOptional()
  // the pattern pins the shape - IsISO8601 alone also takes a timestamp or
  // "2026-08" - and strict mode then refuses a day that does not exist
  @Matches(ISO_DAY, { message: 'from must be a date as YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'from must be a real calendar date' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-08-31', description: 'last day, inclusive, UTC' })
  @IsOptional()
  @Matches(ISO_DAY, { message: 'to must be a date as YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'to must be a real calendar date' })
  to?: string;
}
