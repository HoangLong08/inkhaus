import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  CUSTOMER_ORDER_FILTERS,
  CUSTOMER_SORTS,
  type CustomerOrderFilter,
  type CustomerSort,
} from '@inkhaus/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class AdminListCustomersDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'part of an email, name, company or phone number - any case',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  // not @IsEmail: the box is filled in a keystroke at a time
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: CUSTOMER_SORTS, default: 'created_desc' })
  @IsOptional()
  @IsIn(CUSTOMER_SORTS)
  sort: CustomerSort = 'created_desc';

  @ApiPropertyOptional({
    enum: CUSTOMER_ORDER_FILTERS,
    description: 'yes - has placed at least one order; no - never has. Drafts do not count.',
  })
  @IsOptional()
  @IsIn(CUSTOMER_ORDER_FILTERS)
  hasOrders?: CustomerOrderFilter;
}
