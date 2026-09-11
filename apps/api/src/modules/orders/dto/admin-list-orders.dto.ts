import { ORDER_SORTS, type OrderSort } from '@inkhaus/shared';
import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { DateRangeDto } from '../../../common/dto/date-range.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/** what Prisma's `cuid()` produces: a `c` and 24 more lowercase letters and digits */
const CUID = /^c[a-z0-9]{24}$/;

/**
 * What narrows the order list - shared, word for word, by the list and by its
 * CSV export, so an export is always "what the list shows, every page of it".
 *
 * `from`/`to` come from DateRangeDto: calendar days, both inclusive, UTC. Either
 * may be sent alone; the range is then open on the other side.
 */
export class AdminOrderFilterDto extends DateRangeDto {
  @ApiPropertyOptional({
    description:
      'part of an order number, customer email or name, or ship-to name - any case. "900002" and "ink-900002" both find INK-900002',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  // deliberately not @IsEmail: the box is filled in a keystroke at a time, and
  // a half-typed address used to answer 400 (bug 1)
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    enum: ORDER_SORTS,
    default: 'placed_desc',
    description: 'placed_* keep drafts last either way; number_* follow the order counter',
  })
  @IsOptional()
  @IsIn(ORDER_SORTS)
  sort: OrderSort = 'placed_desc';

  @ApiPropertyOptional({ description: "one customer's orders" })
  @IsOptional()
  @Matches(CUID, { message: 'customerId must be a customer id' })
  customerId?: string;
}

/** GET /admin/orders - the filter plus `page` and `limit` (at most 100) */
export class AdminListOrdersDto extends IntersectionType(PaginationDto, AdminOrderFilterDto) {}
