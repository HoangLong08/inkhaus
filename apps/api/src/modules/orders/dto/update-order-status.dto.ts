import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { ORDER_NOTE_MAX } from '@inkhaus/shared';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

import { TrackingDto } from './tracking.dto';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional({ description: 'shows up on the order timeline', maxLength: ORDER_NOTE_MAX })
  @IsOptional()
  @IsString()
  // the shared constant the admin form validates with - they used to be 500
  // and 300, and the admin let people type notes the API then refused (bug 2)
  @MaxLength(ORDER_NOTE_MAX)
  note?: string;

  @ApiPropertyOptional({
    type: TrackingDto,
    description: 'required to move an order to SHIPPED, unless it already has tracking',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TrackingDto)
  tracking?: TrackingDto;
}
