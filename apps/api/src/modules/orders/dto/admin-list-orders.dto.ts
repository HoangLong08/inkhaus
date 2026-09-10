import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class AdminListOrdersDto extends PaginationDto {
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
}
